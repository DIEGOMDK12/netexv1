import axios from 'axios';

interface WhatsAppConfig {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
  evolutionUrl?: string;
  evolutionKey?: string;
  evolutionInstance?: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

type WhatsAppProvider = 'meta' | 'evolution' | 'none';

class WhatsAppService {
  private config: WhatsAppConfig;
  private provider: WhatsAppProvider = 'none';

  constructor() {
    this.config = {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
      evolutionUrl: process.env.EVOLUTION_API_URL,
      evolutionKey: process.env.EVOLUTION_API_KEY,
      evolutionInstance: process.env.EVOLUTION_INSTANCE,
    };
    
    if (this.config.evolutionUrl && this.config.evolutionKey && this.config.evolutionInstance) {
      this.provider = 'evolution';
      console.log('[WhatsApp] Evolution API configured and ready');
    } else if (this.config.phoneNumberId && this.config.accessToken) {
      this.provider = 'meta';
      console.log('[WhatsApp] Meta Business API configured and ready');
    } else {
      console.log('[WhatsApp] Service not configured - set Evolution API or Meta Business API credentials');
    }
  }

  async sendMessage(to: string, message: string): Promise<SendMessageResult> {
    if (this.provider === 'none') {
      console.log(`[WhatsApp] Would send to ${to}: ${message}`);
      return { 
        success: false, 
        error: 'WhatsApp not configured - message logged only' 
      };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(to);
      
      if (this.provider === 'evolution') {
        return await this.sendViaEvolution(formattedNumber, message);
      } else {
        return await this.sendViaMeta(formattedNumber, message);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || error.message;
      console.error(`[WhatsApp] Failed to send message to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  private async sendViaEvolution(to: string, message: string): Promise<SendMessageResult> {
    const response = await axios.post(
      `${this.config.evolutionUrl}/message/sendText/${this.config.evolutionInstance}`,
      {
        number: to,
        text: message
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.config.evolutionKey!
        }
      }
    );

    console.log(`[WhatsApp] Message sent via Evolution API to ${to}`);
    return {
      success: true,
      messageId: response.data?.key?.id || response.data?.messageId
    };
  }

  private async sendViaMeta(to: string, message: string): Promise<SendMessageResult> {
    const response = await axios.post(
      `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
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

    console.log(`[WhatsApp] Message sent via Meta API to ${to}`);
    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id
    };
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
    return this.provider !== 'none';
  }

  getProvider(): WhatsAppProvider {
    return this.provider;
  }
}

export const whatsappService = new WhatsAppService();
