import axios from "axios";
import crypto from "node:crypto";

const ABACATEPAY_API_URL = "https://api.abacatepay.com/v1";

function getWebhookSecret(): string {
  return process.env.ABACATEPAY_WEBHOOK_SECRET || process.env.ABACATEPAY_API_KEY || "";
}

interface CreatePixPaymentParams {
  orderId: number;
  amount: number;
  email: string;
  description?: string;
  customerName?: string;
}

interface AbacatePayBillingResponse {
  data: {
    id: string;
    url: string;
    amount: number;
    status: string;
    devMode: boolean;
    methods: string[];
    products: Array<{
      id: string;
      externalId: string;
      quantity: number;
    }>;
    frequency: string;
    nextBilling: string | null;
    customer: {
      id: string;
      metadata: {
        name: string;
        email: string;
        cellphone: string;
        taxId: string;
      };
    } | null;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    pixQrCode?: string;
    pixCopiaECola?: string;
    brCode?: string;
  };
  error: string | null;
}

interface AbacatePayWebhookPayload {
  id: string;
  data: {
    payment?: {
      amount: number;
      fee: number;
      method: string;
    };
    pixQrCode?: {
      amount: number;
      id: string;
    };
    billing?: {
      id: string;
      products: Array<{
        externalId: string;
        quantity: number;
      }>;
      customer?: {
        metadata?: {
          email?: string;
        };
      };
      metadata?: {
        orderId?: string;
      };
    };
  };
  devMode: boolean;
  event: string;
}

function getAbacatePayToken(): string {
  const token = process.env.ABACATEPAY_API_KEY;
  if (!token) {
    throw new Error("ABACATEPAY_API_KEY não configurada. Configure a chave API do Abacate Pay.");
  }
  return token;
}

export function verifyAbacateSignature(rawBody: string | Buffer, signatureFromHeader: string): boolean {
  try {
    const webhookSecret = getWebhookSecret();
    
    // If no webhook secret is configured, require signature using API key as fallback
    if (!webhookSecret) {
      console.warn("[AbacatePay] No webhook secret configured - rejecting webhook for security");
      return false;
    }
    
    if (!signatureFromHeader) {
      console.warn("[AbacatePay] No signature provided in webhook request");
      return false;
    }
    
    const bodyBuffer = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyBuffer)
      .digest("base64");
    
    const A = Buffer.from(expectedSig);
    const B = Buffer.from(signatureFromHeader);
    
    if (A.length !== B.length) {
      console.warn("[AbacatePay] Signature length mismatch");
      return false;
    }
    
    return crypto.timingSafeEqual(A, B);
  } catch (error) {
    console.error("[AbacatePay] Error verifying signature:", error);
    return false;
  }
}

interface PixQrCodeResponse {
  data: {
    id: string;
    amount: number;
    status: string;
    devMode: boolean;
    brCode: string;
    brCodeBase64?: string;
    platformFee: number;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
  };
  error: string | null;
}

export async function createPixPayment(params: CreatePixPaymentParams): Promise<{
  success: boolean;
  billingId: string;
  pixCode: string;
  pixQrCodeUrl: string | null;
  checkoutUrl: string;
  status: string;
}> {
  const { orderId, amount, email, description, customerName } = params;
  const token = getAbacatePayToken();

  const amountInCents = Math.round(amount * 100);

  // Support APP_URL for Render/external deployments, fallback to REPLIT_DOMAINS
  const baseUrl = process.env.APP_URL 
    || (process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
        : 'https://example.com');

  // Use pixQrCode/create endpoint to get brCode directly
  const pixPayload: Record<string, any> = {
    amount: amountInCents,
    expiresIn: 86400, // 24 hours
    description: description || `Pedido #${orderId}`,
  };

  if (email) {
    pixPayload.customer = {
      email: email,
      name: customerName || email.split("@")[0] || "Cliente",
      cellphone: "11999999999",
      taxId: "52998224725",
    };
  }

  console.log(`[AbacatePay] Creating PIX QR Code for order ${orderId}`, {
    amount: amountInCents,
    email,
    tokenLength: token.length,
  });

  try {
    const response = await axios.post<PixQrCodeResponse>(
      `${ABACATEPAY_API_URL}/pixQrCode/create`,
      pixPayload,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const pixData = response.data.data;
    console.log(`[AbacatePay] PIX QR Code created successfully:`, pixData.id);

    return {
      success: true,
      billingId: pixData.id,
      pixCode: pixData.brCode || "",
      pixQrCodeUrl: pixData.brCodeBase64 || null,
      checkoutUrl: `${baseUrl}/order-success?orderId=${orderId}`,
      status: pixData.status,
    };
  } catch (error: any) {
    console.error("[AbacatePay] Error creating PIX payment:", error.response?.data || error.message);
    
    if (error.response?.data?.error) {
      throw new Error(`AbacatePay: ${error.response.data.error}`);
    }
    
    throw new Error(`Falha ao criar pagamento PIX: ${error.message}`);
  }
}

export async function checkPaymentStatus(billingId: string): Promise<{
  status: string;
  isPaid: boolean;
  billingId: string;
}> {
  const token = getAbacatePayToken();

  try {
    // Try pixQrCode list first (for PIX payments created with pixQrCode/create)
    const response = await axios.get(
      `${ABACATEPAY_API_URL}/pixQrCode/list`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const pixCodes = response.data.data || [];
    const pixCode = pixCodes.find((p: any) => p.id === billingId);

    if (pixCode) {
      const isPaid = pixCode.status === "PAID" || pixCode.status === "COMPLETED";
      return {
        status: pixCode.status,
        isPaid,
        billingId,
      };
    }

    // Fallback to billing list for older payments
    const billingResponse = await axios.get(
      `${ABACATEPAY_API_URL}/billing/list`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const billings = billingResponse.data.data || [];
    const billing = billings.find((b: any) => b.id === billingId);

    if (!billing) {
      return {
        status: "NOT_FOUND",
        isPaid: false,
        billingId,
      };
    }

    const isPaid = billing.status === "PAID" || billing.status === "COMPLETED";

    return {
      status: billing.status,
      isPaid,
      billingId,
    };
  } catch (error: any) {
    console.error("[AbacatePay] Error checking payment status:", error.response?.data || error.message);
    throw new Error("Falha ao verificar status do pagamento");
  }
}

export function parseWebhookPayload(payload: AbacatePayWebhookPayload): {
  event: string;
  orderId: string | null;
  isPaid: boolean;
  amount: number;
  billingId: string | null;
} {
  const orderId = payload.data.billing?.metadata?.orderId || 
                  payload.data.billing?.products?.[0]?.externalId?.replace("order-", "") || 
                  null;
  
  const isPaid = payload.event === "billing.paid" || 
                 payload.event === "payment.confirmed" ||
                 payload.event === "BILLING.PAID";
  
  const amount = payload.data.payment?.amount || 
                 payload.data.pixQrCode?.amount || 
                 0;
  
  const billingId = payload.data.billing?.id || 
                    payload.data.pixQrCode?.id || 
                    null;

  return {
    event: payload.event,
    orderId,
    isPaid,
    amount,
    billingId,
  };
}
