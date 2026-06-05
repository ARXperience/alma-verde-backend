import { Injectable, Global, Module } from '@nestjs/common';
import * as crypto from 'crypto';

export interface BoldPaymentRequest {
  orderId: string;
  amount: number;
  currency: 'COP';
  description: string;
  tax?: number;
  email: string;
}

@Injectable()
export class BoldService {
  private apiUrl = process.env.BOLD_API_URL || 'https://integrations.bold.co/payment-exchange/v1';
  private apiKey = process.env.BOLD_API_KEY || '';
  private integrityKey = process.env.BOLD_INTEGRITY_KEY || '';

  private generateIntegritySignature(orderId: string, amount: number): string {
    const rawString = `${orderId}${amount}COP${this.integrityKey}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  async createPaymentLink(request: BoldPaymentRequest): Promise<{ payment_link: string, transaction_id: string }> {
    const signature = this.generateIntegritySignature(request.orderId, request.amount);

    const payload = {
      integrity_signature: signature,
      description: request.description,
      tax: request.tax || 0,
      amount: request.amount,
      currency: request.currency,
      order_id: request.orderId,
      customer_data: { email: request.email },
      redirection_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?payment_status=success&order_id=${request.orderId}`,
      webhook_url: `${process.env.NEXT_PUBLIC_API_URL}/bold/webhook`, // Adjusted for backend
      allowed_payment_methods: ["CARD", "PSE", "NEQUI"]
    };

    const response = await fetch(`${this.apiUrl}/payment_links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `x-api-key ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Bold API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      payment_link: data.payload?.url || data.url,
      transaction_id: data.payload?.payment_link_id || data.id
    };
  }
}

@Global()
@Module({
  providers: [BoldService],
  exports: [BoldService],
})
export class BoldModule {}
