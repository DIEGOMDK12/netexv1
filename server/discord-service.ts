import axios from 'axios';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface SendNotificationResult {
  success: boolean;
  error?: string;
}

class DiscordService {
  private webhookUrl: string | undefined;
  private adminWebhookUrl: string | undefined;
  private isConfigured: boolean = false;
  private isAdminConfigured: boolean = false;

  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.adminWebhookUrl = process.env.ADMIN_DISCORD_WEBHOOK_URL;
    this.isConfigured = !!this.webhookUrl;
    this.isAdminConfigured = !!this.adminWebhookUrl;
    
    if (this.isConfigured) {
      console.log('[Discord] Webhook configured and ready');
    } else {
      console.log('[Discord] Service not configured - set DISCORD_WEBHOOK_URL');
    }
    
    if (this.isAdminConfigured) {
      console.log('[Discord] Admin webhook configured and ready');
    } else {
      console.log('[Discord] Admin webhook not configured - set ADMIN_DISCORD_WEBHOOK_URL');
    }
  }

  setAdminWebhookUrl(url: string | undefined) {
    this.adminWebhookUrl = url;
    this.isAdminConfigured = !!url;
  }

  getAdminWebhookUrl(): string | undefined {
    return this.adminWebhookUrl;
  }

  isAdminReady(): boolean {
    return this.isAdminConfigured;
  }

  async sendMessage(content: string, embeds?: DiscordEmbed[]): Promise<SendNotificationResult> {
    if (!this.isConfigured) {
      console.log(`[Discord] Would send: ${content}`);
      return { success: false, error: 'Discord not configured' };
    }

    try {
      await axios.post(this.webhookUrl!, {
        content,
        embeds
      });
      console.log('[Discord] Message sent successfully');
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('[Discord] Failed to send message:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async sendAdminMessage(content: string, embeds?: DiscordEmbed[]): Promise<SendNotificationResult> {
    if (!this.isAdminConfigured) {
      console.log(`[Discord Admin] Would send: ${content}`);
      return { success: false, error: 'Admin Discord not configured' };
    }

    try {
      await axios.post(this.adminWebhookUrl!, {
        content,
        embeds
      });
      console.log('[Discord Admin] Message sent successfully');
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('[Discord Admin] Failed to send message:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async sendNewCustomerNotification(customerDetails: {
    orderId: number;
    customerName: string;
    email: string;
    whatsapp: string;
    totalAmount: string;
    productName: string;
  }): Promise<SendNotificationResult> {
    const embed: DiscordEmbed = {
      title: 'Novo Cliente',
      color: 0x5865f2,
      fields: [
        { name: 'Pedido', value: `#${customerDetails.orderId}`, inline: true },
        { name: 'Cliente', value: customerDetails.customerName || 'N/A', inline: true },
        { name: 'Email', value: customerDetails.email, inline: true },
        { name: 'WhatsApp', value: customerDetails.whatsapp || 'N/A', inline: true },
        { name: 'Produto', value: customerDetails.productName, inline: true },
        { name: 'Valor', value: `R$ ${customerDetails.totalAmount}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendAdminMessage('', [embed]);
  }

  async sendPaidPurchaseNotification(orderDetails: {
    orderId: number;
    customerName: string;
    email: string;
    totalAmount: string;
    productName: string;
  }): Promise<SendNotificationResult> {
    const embed: DiscordEmbed = {
      title: 'Compra Paga',
      color: 0x00ff00,
      fields: [
        { name: 'Pedido', value: `#${orderDetails.orderId}`, inline: true },
        { name: 'Cliente', value: orderDetails.customerName || 'N/A', inline: true },
        { name: 'Email', value: orderDetails.email, inline: true },
        { name: 'Produto', value: orderDetails.productName, inline: true },
        { name: 'Valor', value: `R$ ${orderDetails.totalAmount}`, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendAdminMessage('', [embed]);
  }

  async sendSaleNotification(orderDetails: {
    orderId: number;
    productName: string;
    quantity: number;
    totalAmount: string;
    buyerName: string;
    status: string;
  }): Promise<SendNotificationResult> {
    const embed: DiscordEmbed = {
      title: '💰 Nova Venda!',
      color: 0x00ff00,
      fields: [
        { name: 'Pedido', value: `#${orderDetails.orderId}`, inline: true },
        { name: 'Produto', value: orderDetails.productName, inline: true },
        { name: 'Quantidade', value: String(orderDetails.quantity), inline: true },
        { name: 'Valor Total', value: `R$ ${orderDetails.totalAmount}`, inline: true },
        { name: 'Comprador', value: orderDetails.buyerName, inline: true },
        { name: 'Status', value: orderDetails.status, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendMessage('', [embed]);
  }

  async sendOrderStatusNotification(orderDetails: {
    orderId: number;
    productName: string;
    newStatus: string;
    buyerName: string;
  }): Promise<SendNotificationResult> {
    const statusColors: Record<string, number> = {
      'paid': 0x00ff00,
      'delivered': 0x0099ff,
      'cancelled': 0xff0000,
      'pending': 0xffaa00,
      'disputed': 0xff6600,
    };

    const embed: DiscordEmbed = {
      title: '📦 Atualização de Pedido',
      color: statusColors[orderDetails.newStatus] || 0x808080,
      fields: [
        { name: 'Pedido', value: `#${orderDetails.orderId}`, inline: true },
        { name: 'Produto', value: orderDetails.productName, inline: true },
        { name: 'Novo Status', value: orderDetails.newStatus.toUpperCase(), inline: true },
        { name: 'Comprador', value: orderDetails.buyerName, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendMessage('', [embed]);
  }

  async sendNewMessageNotification(messageDetails: {
    from: string;
    preview: string;
    orderId?: number;
  }): Promise<SendNotificationResult> {
    const embed: DiscordEmbed = {
      title: '💬 Nova Mensagem',
      color: 0x5865f2,
      fields: [
        { name: 'De', value: messageDetails.from, inline: true },
        ...(messageDetails.orderId ? [{ name: 'Pedido', value: `#${messageDetails.orderId}`, inline: true }] : []),
        { name: 'Mensagem', value: messageDetails.preview.substring(0, 200) + (messageDetails.preview.length > 200 ? '...' : ''), inline: false },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendMessage('', [embed]);
  }

  async sendPaymentConfirmation(paymentDetails: {
    orderId: number;
    amount: string;
    method: string;
  }): Promise<SendNotificationResult> {
    const embed: DiscordEmbed = {
      title: '✅ Pagamento Confirmado',
      color: 0x00ff00,
      fields: [
        { name: 'Pedido', value: `#${paymentDetails.orderId}`, inline: true },
        { name: 'Valor', value: `R$ ${paymentDetails.amount}`, inline: true },
        { name: 'Método', value: paymentDetails.method, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'GOLDNET Marketplace' }
    };

    return this.sendMessage('', [embed]);
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const discordService = new DiscordService();
