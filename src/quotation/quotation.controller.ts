import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseService } from '../supabase/supabase.module';
import { GeminiService } from '../gemini/gemini.module';
import { OpenAIService } from '../openai/openai.module';

@Controller('quotation')
export class QuotationController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService
  ) {}

  @Post('calculate')
  async calculate(@Body() body: any) {
    const { variables } = body;
    if (!variables) throw new Error('Variables are required');

    const prompt = 'Calcula una cotización detallada basándote en las siguientes variables:\n' + JSON.stringify(variables, null, 2);
    const pricing = await this.geminiService.generateJSON(prompt);
    return { pricing };
  }

  @Post('create-project')
  async createProject(@Body() body: any) {
    const { briefing, variables, description, pricing, render_images } = body;
    if (!variables) throw new Error('Variables are required');

    const supabase = this.supabaseService.getAdminClient();
    
    const projectTypeStr = variables.project_type || 'Proyecto';
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        business_unit: 'alma_verde',
        title: 'Cotización - ' + projectTypeStr,
        description: description || briefing || 'Proyecto generado con IA',
        project_type: (variables.project_type || 'otro').toLowerCase(),
        status: 'cotizacion',
        estimated_cost: pricing?.total || 0,
        briefing: briefing || null,
        extracted_variables: variables || {},
        pricing_breakdown: pricing || {},
        metadata: {
          area: parseFloat(variables.square_meters?.toString() || '0'),
          location: variables.location || null,
          ai_generated: true,
          ai_prompt: briefing || null,
          render_images: render_images || []
        }
      })
      .select()
      .single();

    if (projectError) throw new Error('Failed to create project: ' + projectError.message);

    if (render_images && render_images.length > 0 && project) {
      const renderInserts = render_images.map((img: any, index: number) => ({
        project_id: project.id,
        image_url: img.url,
        prompt: img.prompt,
        version: index + 1,
        is_selected: index === 0,
        status: 'completed'
      }));

      await supabase.from('project_renders').insert(renderInserts);
    }

    return { project, message: 'Project created successfully' };
  }

  @Post('extract')
  async extract(@Body() body: any) {
    const { briefing } = body;
    if (!briefing) throw new Error('Briefing is required');

    const prompt = 'You are an AI Cost Estimator. Extract variables into JSON:\n\n' + briefing;
    const variables = await this.geminiService.generateJSON(prompt);
    return { variables };
  }

  @Post('generate-image')
  async generateImage(@Body() body: any) {
    const { projectId, projectDetails } = body;
    if (!projectId) throw new Error('Project ID is required');

    const imageUrl = await this.openaiService.generateProjectRender({
      projectType: projectDetails.project_type || 'exhibition stand',
      squareMeters: projectDetails.square_meters,
      materials: projectDetails.materials || [],
      stylePreferences: projectDetails.style_preferences,
      description: projectDetails.description
    });

    const projectTypeDesc = projectDetails.project_type || 'exhibition stand';
    const supabase = this.supabaseService.getAdminClient();
    const { data: renderData } = await supabase
      .from('project_renders')
      .insert({
        project_id: projectId,
        iteration: 1,
        description: 'AI-generated render for ' + projectTypeDesc,
        image_url: imageUrl,
        status: 'completed',
      })
      .select()
      .single();

    return { success: true, imageUrl, renderId: renderData?.id };
  }

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  async transcribe(@UploadedFile() file: any) {
    if (!file) throw new Error('No file provided');
    return { text: "Transcription is mocked in this minimal backend setup." };
  }
}
