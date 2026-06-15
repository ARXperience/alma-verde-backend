import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import type { Response } from 'express';

@Controller('api/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('status')
  getStatus() {
    return this.whatsappService.getStatus();
  }

  @Get('qr')
  getQr(@Res() res: Response) {
    const qr = this.whatsappService.getQr();
    if (qr) {
      return res.json({ qr });
    }
    return res.status(HttpStatus.NOT_FOUND).json({ error: 'No QR available' });
  }

  @Post('send')
  async sendMessage(@Body() body: { phone: string; message: string }, @Res() res: Response) {
    try {
      await this.whatsappService.sendMessage(body.phone, body.message);
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
  }

  @Post('knowledge')
  setKnowledge(@Body('knowledge') knowledge: string, @Res() res: Response) {
    if (!knowledge) return res.status(HttpStatus.BAD_REQUEST).json({ error: 'knowledge field required' });
    this.whatsappService.setKnowledge(knowledge);
    return res.json({ success: true });
  }

  @Get('knowledge')
  getKnowledge() {
    return { knowledge: this.whatsappService.getKnowledge() };
  }

  @Post('behavior')
  setBehavior(@Body('behavior') behavior: string, @Res() res: Response) {
    if (!behavior) return res.status(HttpStatus.BAD_REQUEST).json({ error: 'behavior field required' });
    this.whatsappService.setBehavior(behavior);
    return res.json({ success: true });
  }

  @Get('behavior')
  getBehavior() {
    return { behavior: this.whatsappService.getBehavior() };
  }

  @Post('restart')
  restart(@Res() res: Response) {
    this.whatsappService.restart();
    return res.json({ success: true, message: 'Restarting session...' });
  }

  @Post('toggle-auto-reply')
  toggleAutoReply() {
    return { autoReply: this.whatsappService.toggleAutoReply() };
  }
}
