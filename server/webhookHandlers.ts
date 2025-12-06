import Stripe from 'stripe';
import { getStripeClient, getStripeWebhookSecret } from './stripeClient';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();
    
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    
    return event;
  }
  
  static async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    console.log('[Webhook] checkout.session.completed received');
    console.log('[Webhook] Session ID:', session.id);
    console.log('[Webhook] Customer Email:', session.customer_email);
    console.log('[Webhook] Payment Status:', session.payment_status);
    console.log('[Webhook] Amount Total:', session.amount_total);
    console.log('[Webhook] Metadata:', session.metadata);
    
    // TODO: Insira aqui a lógica de liberação de acesso
    // Exemplo:
    // - Buscar o pedido pelo session.metadata.orderId
    // - Atualizar o status do pedido para "paid"
    // - Liberar o conteúdo digital para o cliente
    // - Enviar email de confirmação
    
    console.log('==============================================');
    console.log('[Webhook] INSIRA AQUI A LÓGICA DE LIBERAÇÃO');
    console.log('[Webhook] Dados disponíveis:');
    console.log('[Webhook] - session.id:', session.id);
    console.log('[Webhook] - session.metadata:', JSON.stringify(session.metadata));
    console.log('[Webhook] - session.customer_email:', session.customer_email);
    console.log('[Webhook] - session.amount_total:', session.amount_total);
    console.log('==============================================');
  }
}
