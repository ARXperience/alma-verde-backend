import { Controller, Post, Body } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { BoldService } from '../bold/bold.module';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly boldService: BoldService
  ) {}

  @Post()
  async createCheckout(@Body() body: any) {
    const { projectId, quotationId } = body;
    if (!projectId && !quotationId) {
      throw new Error('Project ID or Quotation ID is required');
    }

    const supabase = this.supabaseService.getAdminClient();
    let amount = 0;
    let description = '';
    let userEmail = '';
    let userId = '';

    if (quotationId) {
      const { data: quoteData, error } = await supabase
        .from('quotations')
        .select('*, user:users(id, email)')
        .eq('id', quotationId)
        .single();

      if (error || !quoteData) throw new Error('Quotation not found');
      
      amount = quoteData.total;
      description = `Pago de Cotización #${quoteData.number}`;
      userEmail = quoteData.user?.email || '';
      userId = quoteData.user?.id || '';
    } else if (projectId) {
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('*, user:users(id, email)')
        .eq('id', projectId)
        .single();

      if (error || !projectData) throw new Error('Project not found');
      
      amount = (projectData.budget || 0) * 0.5;
      description = `Anticipo Proyecto: ${projectData.title}`;
      userEmail = projectData.user?.email || '';
      userId = projectData.user?.id || '';
    }

    if (amount <= 0) throw new Error('Invalid amount');

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const paymentResponse = await this.boldService.createPaymentLink({
      orderId,
      amount: Math.round(amount),
      currency: 'COP',
      description,
      email: userEmail,
      tax: 0
    });

    await supabase.from('orders').insert({
      orderNumber: orderId,
      total: amount,
      subtotal: amount,
      tax: 0,
      status: 'PENDING',
      userId: userId,
      projectId: projectId || null,
      quotationId: quotationId || null,
      notes: description
    });

    return {
      paymentUrl: paymentResponse.payment_link,
      transactionId: paymentResponse.transaction_id
    };
  }
}
