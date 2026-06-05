import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('upload')
export class UploadController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Body() body: any) {
    if (!file) {
      throw new Error('No files received');
    }

    const bucket = body.bucket || 'product-images';
    const folder = body.folder || '';
    const filename = file.originalname.replaceAll(' ', '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = filename.split('.').pop();
    const basename = filename.replace(`.${ext}`, '');
    const finalName = `${folder ? folder + '/' : ''}${basename}-${uniqueSuffix}.${ext}`;

    const supabase = this.supabaseService.getAdminClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(finalName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      throw new Error(`Supabase Storage Error: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      message: 'File uploaded successfully',
      url: publicUrl,
      path: data.path
    };
  }
}
