import { Controller, Get, Post, Put, Delete, Body, Param, Req, Res, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  async getPublished() {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*, project:projects(id, title, metadata)')
      .not('published_at', 'is', null)
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [] };
  }

  @Get('admin')
  async getAdmin() {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data || [] };
  }

  @Get('by-project/:projectId')
  async getByProject(@Param('projectId') projectId: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) throw error;
    return { data };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*, project:projects(id, title, project_type, metadata)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return { data };
  }

  @Post()
  async create(@Body() body: any) {
    if (!body.title) throw new Error('Title is required');
    const supabase = this.supabaseService.getAdminClient();
    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({
        project_id: body.project_id || null,
        title: body.title,
        description: body.description || null,
        featured_image_url: body.featured_image_url || null,
        gallery_images: body.gallery_images || [],
        tags: body.tags || [],
        is_featured: body.is_featured || false,
        display_order: body.display_order || 0,
        business_unit: 'alma_verde',
        published_at: body.published_at || null
      })
      .select()
      .single();

    if (error) throw error;
    return { data };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const supabase = this.supabaseService.getAdminClient();
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.featured_image_url !== undefined) updateData.featured_image_url = body.featured_image_url;
    if (body.gallery_images !== undefined) updateData.gallery_images = body.gallery_images;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.published_at !== undefined) updateData.published_at = body.published_at;

    const { data, error } = await supabase
      .from('portfolio_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { data };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const supabase = this.supabaseService.getAdminClient();
    const { error } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  }
}
