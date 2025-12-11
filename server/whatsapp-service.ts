import axios from 'axios';

interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class WhatsAppService {
  private config: WhatsAppConfig;
  private isConfigured: boolean = false;

  constructor() {
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
    };
    
    this.isConfigured = !!(this.config.phoneNumberId && this.config.accessToken);
    
    if (!this.isConfigured) {
      console.log('[WhatsApp] Service not configured - WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN required');
    } else {
      console.log('[WhatsApp] Service configured and ready');
    }
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    if (!this.isConfigured) {
      console.log(`[WhatsApp] Would send to ${to}: ${message}`);
      return { 
        success: false, 
        error: 'WhatsApp not configured - message logged only' 
      };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      const response = await axios.post(
        `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedNumber,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.accessToken}`
          }
        }
      );

      console.log(`[WhatsApp] Message sent successfully to ${formattedNumber}`);
      return {
        success: true,
        messageId: response.data?.messages?.[0]?.id
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      console.error(`[WhatsApp] Failed to send message to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<SendMessageResult> {
    const message = `Seu codigo de verificacao para notificacoes de vendas: ${code}\n\nEste codigo expira em 10 minutos.`;
    return this.sendMessage(to, message);
  }

  async sendSaleNotification(
    to: string, 
    orderDetails: {
      orderId: number;
      customerEmail: string;
      totalAmount: string;
      productNames: string[];
      storeName: string;
    }
  ): Promise<SendMessageResult> {
    const productList = orderDetails.productNames.join(', ');
    const message = `Nova venda na sua loja ${orderDetails.storeName}!\n\nPedido #${orderDetails.orderId}\nCliente: ${orderDetails.customerEmail}\nProdutos: ${productList}\nTotal: R$ ${orderDetails.totalAmount}\n\nAcesse o painel para mais detalhes.`;
    
    return this.sendMessage(to, message);
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

export const whatsappService = new WhatsAppService();
