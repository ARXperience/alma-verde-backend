import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, WASocket } from '@whiskeysockets/baileys';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
  private sock: WASocket | null = null;
  private qrImage: string | null = null;
  private connectionStatus: 'disconnected' | 'qr_ready' | 'connected' = 'disconnected';
  private autoReplyEnabled = true;
  private conversationCache = new Map<string, { role: string; content: string }[]>();
  
  private genAI: GoogleGenerativeAI | null = null;
  private geminiModel: any = null;
  private supabase: SupabaseClient | null = null;

  private readonly KNOWLEDGE_DIR = path.join(process.cwd(), 'whatsapp-data', 'knowledge');
  private readonly KNOWLEDGE_FILE = path.join(this.KNOWLEDGE_DIR, 'base.txt');
  private readonly BEHAVIOR_FILE = path.join(this.KNOWLEDGE_DIR, 'behavior.txt');
  private readonly SESSION_DIR = path.join(process.cwd(), '.whatsapp-session');

  constructor(private configService: ConfigService) {
    this.initClients();
    this.ensureDirectories();
  }

  async onModuleInit() {
    try {
      await this.startWhatsApp();
    } catch (e: any) {
      console.error('Error starting WhatsApp bot (likely read-only filesystem):', e.message);
    }
  }

  onModuleDestroy() {
    if (this.sock) {
      try {
        this.sock.logout();
      } catch (e) {}
    }
  }

  private initClients() {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY') || 
                      this.configService.get<string>('NEXT_PUBLIC_GEMINI_API_KEY') || 
                      this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
                      
    if (geminiKey) {
      this.genAI = new GoogleGenerativeAI(geminiKey);
      this.geminiModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ Gemini AI initialized for WhatsApp Bot');
    }

    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') || this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || this.configService.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.KNOWLEDGE_DIR)) fs.mkdirSync(this.KNOWLEDGE_DIR, { recursive: true });
      if (!fs.existsSync(this.SESSION_DIR)) fs.mkdirSync(this.SESSION_DIR, { recursive: true });

      if (!fs.existsSync(this.KNOWLEDGE_FILE)) {
        fs.writeFileSync(this.KNOWLEDGE_FILE, `Alma Verde Diseño es una agencia de diseño y productora de eventos.
Servicios: Stands para ferias, eventos corporativos, branding, decoración, muebles (Alma Home).
Teléfono: +57 XXX XXX XXXX
Email: centrodigitaldediseno@gmail.com`);
      }

      if (!fs.existsSync(this.BEHAVIOR_FILE)) {
        fs.writeFileSync(this.BEHAVIOR_FILE, `Eres el asistente virtual de Alma Verde Diseño por WhatsApp. 
Responde de forma amigable, profesional y concisa en español.
Usa emojis moderadamente.
Si el cliente pregunta por precios, invítalo a cotizar en almaverdediseno.com/cotizar o a enviar detalles de su proyecto.
Si detectas intención de compra o cotización, recopila: nombre, tipo de proyecto, presupuesto aproximado.`);
      }
    } catch (e: any) {
      console.error('Error creating whatsapp directories. If you are on Vercel, the file system is read-only:', e.message);
    }
  }

  getKnowledge(): string {
    try {
      return fs.readFileSync(this.KNOWLEDGE_FILE, 'utf-8');
    } catch {
      return '';
    }
  }

  setKnowledge(text: string) {
    fs.writeFileSync(this.KNOWLEDGE_FILE, text, 'utf-8');
  }

  getBehavior(): string {
    try {
      return fs.readFileSync(this.BEHAVIOR_FILE, 'utf-8');
    } catch {
      return '';
    }
  }

  setBehavior(text: string) {
    fs.writeFileSync(this.BEHAVIOR_FILE, text, 'utf-8');
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      qr: this.qrImage,
      autoReply: this.autoReplyEnabled,
    };
  }

  getQr() {
    return this.qrImage;
  }

  toggleAutoReply() {
    this.autoReplyEnabled = !this.autoReplyEnabled;
    return this.autoReplyEnabled;
  }

  async sendMessage(phone: string, message: string) {
    if (!this.sock || this.connectionStatus !== 'connected') {
      throw new Error('WhatsApp not connected');
    }
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text: message });
  }

  restart() {
    console.log('🔄 Restarting WhatsApp connection to clear session...');
    setTimeout(() => {
      try {
        if (this.sock) {
          try { this.sock.logout(); } catch (e) {}
        }
        if (fs.existsSync(this.SESSION_DIR)) {
          fs.rmSync(this.SESSION_DIR, { recursive: true, force: true });
          console.log('🗑️ Session directory deleted.');
        }
      } catch (e: any) {
        console.error('Error clearing session (read-only filesystem?):', e.message);
      }
      this.connectionStatus = 'disconnected';
      this.qrImage = null;
      setTimeout(() => {
        try {
          this.startWhatsApp();
          console.log('🔄 Session cleared, generating new QR code...');
        } catch (e: any) {
          console.error('Error restarting WhatsApp bot:', e.message);
        }
      }, 1000);
    }, 2000);
  }

  private async getAIResponse(phone: string, userMessage: string): Promise<string> {
    if (!this.geminiModel) return 'Hola, gracias por escribirnos. Un asesor se comunicará contigo pronto. 🌿';

    const history = this.conversationCache.get(phone) || [];
    history.push({ role: 'user', content: userMessage });

    if (history.length > 20) history.splice(0, history.length - 20);

    const knowledge = this.getKnowledge();
    const behavior = this.getBehavior();
    const systemPrompt = `${behavior}\n\nBASE DE CONOCIMIENTOS:\n${knowledge}\n\nHISTORIAL DE CONVERSACIÓN:\n${history.map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`).join('\n')}\n\nResponde al último mensaje del cliente de forma natural y breve (máximo 3 párrafos cortos).`;

    try {
      const result = await this.geminiModel.generateContent(systemPrompt);
      const response = result.response.text();

      history.push({ role: 'assistant', content: response });
      this.conversationCache.set(phone, history);

      if (this.supabase) {
        this.syncToSupabase(phone, history, userMessage);
      }

      return response;
    } catch (error) {
      console.error('Gemini error:', error);
      return 'Disculpa, estoy teniendo dificultades. Un asesor se comunicará contigo pronto. 🌿';
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string | null> {
    if (!this.genAI) return null;
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const audioBase64 = audioBuffer.toString('base64');
      const result = await model.generateContent([
        { inlineData: { mimeType: 'audio/ogg', data: audioBase64 } },
        'Transcribe este audio de WhatsApp al español. Solo devuelve la transcripción, nada más.',
      ]);
      return result.response.text();
    } catch (error) {
      console.error('Audio transcription error:', error);
      return null;
    }
  }

  private async syncToSupabase(phone: string, history: any[], lastUserMessage: string) {
    if (!this.supabase) return;
    try {
      let intent = 'soporte';
      if (lastUserMessage.toLowerCase().includes('cotiza') || lastUserMessage.toLowerCase().includes('precio')) {
        intent = 'cotizacion';
      }

      const formattedPhone = phone.replace('@s.whatsapp.net', '');

      const { data: existing } = await this.supabase
        .from('whatsapp_leads')
        .select('id')
        .eq('phone', formattedPhone)
        .single();

      if (existing) {
        await this.supabase.from('whatsapp_leads').update({
          conversation: history,
          last_message: lastUserMessage,
          intent,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await this.supabase.from('whatsapp_leads').insert({
          phone: formattedPhone,
          conversation: history,
          last_message: lastUserMessage,
          intent,
          status: 'OPEN'
        });
      }
    } catch (error) {
      console.error('Supabase sync error:', error);
    }
  }

  private async startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(this.SESSION_DIR);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['Alma Verde Bot', 'Chrome', '4.0.0'],
    });

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        QRCode.toDataURL(qr, (err, url) => {
          if (!err) {
            this.qrImage = url;
            this.connectionStatus = 'qr_ready';
            console.log('📱 QR code ready - scan from admin panel or terminal');
          }
        });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnecting:', shouldReconnect);
        this.connectionStatus = 'disconnected';
        this.qrImage = null;

        if (shouldReconnect) {
          setTimeout(() => this.startWhatsApp(), 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
        this.connectionStatus = 'connected';
        this.qrImage = null;
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('messages.upsert', async (m: any) => {
      if (!this.autoReplyEnabled) return;

      const msg = m.messages[0];
      if (!msg || msg.key.fromMe || !msg.message) return;

      const phone = msg.key.remoteJid;
      if (!phone || phone.includes('@g.us')) return;

      try {
        let userMessage = '';

        if (msg.message.conversation) {
          userMessage = msg.message.conversation;
        } else if (msg.message.extendedTextMessage) {
          userMessage = msg.message.extendedTextMessage.text;
        } else if (msg.message.audioMessage) {
          console.log(`🎤 Audio received from ${phone}`);
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: console as any, reuploadRequest: () => {} } as any);
          const transcription = await this.transcribeAudio(buffer as Buffer);
          
          if (transcription) {
            userMessage = transcription;
            await this.sock!.sendMessage(phone, { text: `🎤 _Entendí tu audio:_ "${transcription}"\n\n` });
            await new Promise(r => setTimeout(r, 1000));
          } else {
            await this.sock!.sendMessage(phone, {
              text: '🎤 Recibí tu audio pero no pude procesarlo. ¿Podrías escribirme tu consulta? 😊'
            });
            return;
          }
        } else if (msg.message.imageMessage) {
          userMessage = msg.message.imageMessage.caption || 'El cliente envió una imagen.';
        } else {
          return;
        }

        if (!userMessage.trim()) return;

        console.log(`💬 ${phone}: ${userMessage}`);

        const response = await this.getAIResponse(phone, userMessage);
        await this.sock!.sendMessage(phone, { text: response });
        console.log(`🤖 → ${phone}: ${response.substring(0, 100)}...`);

      } catch (error) {
        console.error('Message handling error:', error);
      }
    });
  }
}
