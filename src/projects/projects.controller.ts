import { Controller, Post, Body } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('files')
  async uploadFileMetadata(@Body() body: any) {
    const { project_id, file_name, url, type, size } = body;

    if (!project_id || !file_name || !url) {
      throw new Error('Missing required fields');
    }

    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase
      .from('project_files')
      .insert({
        project_id,
        file_name,
        file_url: url,
        file_type: type,
        file_size: size
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Database insert error: ${error.message}`);
    }

    return { data };
  }
}
