import axios from "axios";
import { storage } from "./storage";

interface CreatePixPaymentParams {
  orderId: number;
  amount: number;
  email: string;
  description?: string;
}

interface PagSeguroQRCode {
  id: string;
  text: string;
  links: Array<{
    rel: string;
    href: string;
    media: string;
  }>;
}

interface PagSeguroCharge {
  id: string;
  reference_id: string;
  status: string;
  amount: {
    value: number;
    currency: string;
  };
  payment_method: {
    type: string;
    boleto?: any;
  };
}

interface PagSeguroOrderResponse {
  id: string;
  reference_id: string;
  charges: PagSeguroCharge[];
  qr_codes?: PagSeguroQRCode[];
}

export async function createPixPayment(params: CreatePixPaymentParams) {
  const { orderId, amount, email, description } = params;

  const settings = await storage.getSettings();

  if (!settings) {
    throw new Error("Configurações não encontradas no banco de dados");
  }

  const { pagseguroToken, pagseguroEmail, pagseguroSandbox } = settings;

  if (!pagseguroToken) {
    throw new Error("Token do PagSeguro não configurado. Configure nas configurações do admin.");
  }

  const isSandbox = pagseguroSandbox ?? true;
  const baseUrl = isSandbox 
    ? "https://sandbox.api.pagseguro.com" 
    : "https://api.pagseguro.com";

  const amountInCents = Math.round(amount * 100);

  const orderPayload = {
    reference_id: `order-${orderId}`,
    customer: {
      name: email.split("@")[0] || "Cliente",
      email: email,
      tax_id: "12345678909",
    },
    items: [
      {
        reference_id: `item-${orderId}`,
        name: description || `Pedido #${orderId}`,
        quantity: 1,
        unit_amount: amountInCents,
      },
    ],
    qr_codes: [
      {
        amount: {
          value: amountInCents,
        },
        expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    notification_urls: [],
  };

  console.log(`[PagSeguro] Creating PIX payment for order ${orderId}`, {
    amount: amountInCents,
    sandbox: isSandbox,
    baseUrl,
  });

  try {
    const response = await axios.post<PagSeguroOrderResponse>(
      `${baseUrl}/orders`,
      orderPayload,
      {
        headers: {
          "Authorization": `Bearer ${pagseguroToken}`,
          "Content-Type": "application/json",
          "x-api-version": "4.0",
        },
      }
    );

    const orderData = response.data;
    console.log(`[PagSeguro] Order created successfully:`, orderData.id);

    const qrCode = orderData.qr_codes?.[0];
    
    if (!qrCode) {
      throw new Error("QR Code não retornado pelo PagSeguro");
    }

    const qrCodeImageLink = qrCode.links?.find(link => link.media === "image/png");

    let qrCodeBase64: string | null = null;
    if (qrCodeImageLink?.href) {
      try {
        const imageResponse = await axios.get(qrCodeImageLink.href, {
          responseType: "arraybuffer",
        });
        qrCodeBase64 = `data:image/png;base64,${Buffer.from(imageResponse.data).toString("base64")}`;
      } catch (imageError) {
        console.error("[PagSeguro] Error fetching QR code image:", imageError);
      }
    }

    return {
      success: true,
      pagseguroOrderId: orderData.id,
      pixCode: qrCode.text,
      qrCodeBase64: qrCodeBase64,
      qrCodeImageUrl: qrCodeImageLink?.href || null,
      status: orderData.charges?.[0]?.status || "WAITING",
    };
  } catch (error: any) {
    console.error("[PagSeguro] Error creating payment:", error.response?.data || error.message);
    
    if (error.response?.data) {
      const errorMessage = error.response.data.error_messages 
        ? error.response.data.error_messages.map((e: any) => e.description).join(", ")
        : error.response.data.message || "Erro desconhecido do PagSeguro";
      throw new Error(`PagSeguro: ${errorMessage}`);
    }
    
    throw new Error(`Falha ao criar pagamento PIX: ${error.message}`);
  }
}

export async function checkPaymentStatus(pagseguroOrderId: string) {
  const settings = await storage.getSettings();

  if (!settings || !settings.pagseguroToken) {
    throw new Error("Configurações do PagSeguro não encontradas");
  }

  const { pagseguroToken, pagseguroSandbox } = settings;
  const isSandbox = pagseguroSandbox ?? true;
  const baseUrl = isSandbox 
    ? "https://sandbox.api.pagseguro.com" 
    : "https://api.pagseguro.com";

  try {
    const response = await axios.get<PagSeguroOrderResponse>(
      `${baseUrl}/orders/${pagseguroOrderId}`,
      {
        headers: {
          "Authorization": `Bearer ${pagseguroToken}`,
          "Content-Type": "application/json",
          "x-api-version": "4.0",
        },
      }
    );

    const orderData = response.data;
    const charge = orderData.charges?.[0];

    return {
      status: charge?.status || "WAITING",
      isPaid: charge?.status === "PAID",
      orderId: orderData.id,
    };
  } catch (error: any) {
    console.error("[PagSeguro] Error checking payment status:", error.response?.data || error.message);
    throw new Error("Falha ao verificar status do pagamento");
  }
}
