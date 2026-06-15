import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { GeminiModule } from './gemini/gemini.module';
import { OpenAIModule } from './openai/openai.module';
import { BoldModule } from './bold/bold.module';

import { PortfolioController } from './portfolio/portfolio.controller';
import { ChatController } from './chat/chat.controller';
import { CheckoutController } from './checkout/checkout.controller';
import { UploadController } from './upload/upload.controller';
import { ProjectsController } from './projects/projects.controller';
import { QuotationController } from './quotation/quotation.controller';
import { WhatsAppModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    GeminiModule,
    OpenAIModule,
    BoldModule,
    WhatsAppModule,
  ],
  controllers: [
    PortfolioController,
    ChatController,
    CheckoutController,
    UploadController,
    ProjectsController,
    QuotationController,
  ],
})
export class AppModule {}
