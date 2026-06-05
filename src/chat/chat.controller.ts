import { Controller, Post, Body } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.module';

@Controller('chat')
export class ChatController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post()
  async chat(@Body() body: any) {
    const { messages, projectContext } = body;
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages array is required');
    }

    const systemPrompt = `Eres un asistente virtual de Alma Verde. Información del proyecto: ${projectContext ? JSON.stringify(projectContext) : 'No específico'}`;

    const geminiMessages = [
      { role: 'user', content: systemPrompt + "\n\n[System Initialization]" },
      { role: 'model', content: "Entendido. Estoy listo para actuar como el asistente de Alma Verde." },
      ...messages
    ];

    const responseText = await this.geminiService.chat(geminiMessages);
    return { message: responseText };
  }
}
