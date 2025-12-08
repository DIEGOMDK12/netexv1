import crypto from 'crypto';

interface WebhookPayload {
  event: string;
  orderId: number;
  email: string;
  customerName?: string;
  whatsapp?: string;
  totalAmount: string;
  products: Array<{
    name: string;
    quantity: number;
    price: string;
  }>;
  storeName: string;
  timestamp: string;
}

export async function sendWebhook(
  webhookUrl: string,
  webhookSecret: string,
  payload: WebhookPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const payloadString = JSON.stringify(payload);
    
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    console.log(`[Webhook] Sending to ${webhookUrl}`);
    console.log(`[Webhook] Payload:`, payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': new Date().toISOString(),
      },
      body: payloadString,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Webhook] Failed with status ${response.status}: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    console.log(`[Webhook] Successfully sent to ${webhookUrl}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Webhook] Error sending webhook:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function triggerPurchaseWebhooks(
  resellerId: number,
  orderData: {
    orderId: number;
    email: string;
    customerName?: string;
    whatsapp?: string;
    totalAmount: string;
    products: Array<{ name: string; quantity: number; price: string }>;
    storeName: string;
  }
): Promise<void> {
  try {
    const { storage } = await import('./storage');
    
    const webhooksList = await storage.getWebhooks(resellerId);
    
    if (webhooksList.length === 0) {
      console.log(`[Webhook] No webhooks configured for reseller ${resellerId}`);
      return;
    }

    const payload: WebhookPayload = {
      event: 'purchase.completed',
      orderId: orderData.orderId,
      email: orderData.email,
      customerName: orderData.customerName,
      whatsapp: orderData.whatsapp,
      totalAmount: orderData.totalAmount,
      products: orderData.products,
      storeName: orderData.storeName,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Webhook] Triggering ${webhooksList.length} webhooks for order ${orderData.orderId}`);

    for (const webhook of webhooksList) {
      if (webhook.active) {
        sendWebhook(webhook.url, webhook.secret, payload)
          .then(result => {
            if (result.success) {
              console.log(`[Webhook] Successfully notified webhook "${webhook.name}" (ID: ${webhook.id})`);
            } else {
              console.error(`[Webhook] Failed to notify webhook "${webhook.name}" (ID: ${webhook.id}): ${result.error}`);
            }
          })
          .catch(err => {
            console.error(`[Webhook] Error notifying webhook "${webhook.name}" (ID: ${webhook.id}):`, err);
          });
      }
    }
  } catch (error: any) {
    console.error(`[Webhook] Error triggering webhooks:`, error.message);
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
