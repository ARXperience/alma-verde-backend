import { Injectable, Global, Module } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  public openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'DUMMY_KEY',
    });
  }

  async generateImage(
    prompt: string,
    size: '1024x1024' | '1024x1792' | '1792x1024' = '1024x1024',
    quality: 'standard' | 'hd' = 'hd'
  ): Promise<string> {
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      response_format: 'url',
    });
    return response?.data?.[0]?.url || '';
  }

  async generateProjectRender(projectDetails: any): Promise<string> {
    const prompt = `
Professional architectural 3D render of a ${projectDetails.projectType}.
${projectDetails.squareMeters ? `Size: ${projectDetails.squareMeters} square meters.` : ''}
${projectDetails.materials && projectDetails.materials.length > 0 ? `Materials: ${projectDetails.materials.join(', ')}.` : ''}
${projectDetails.stylePreferences ? `Style: ${projectDetails.stylePreferences}.` : 'Modern and professional style.'}
${projectDetails.description || ''}

The render should be:
- Photorealistic and high quality
- Well-lit with professional lighting
- Show the complete structure from an attractive angle
- Include context and environment
- Professional architectural visualization quality
`.trim();
    return this.generateImage(prompt, '1792x1024', 'hd');
  }
}

@Global()
@Module({
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
