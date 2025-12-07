import axios from "axios";

const PAGSEGURO_API_URL = "https://api.pagseguro.com";
const PAGSEGURO_CONNECT_URL = "https://connect.pagseguro.uol.com.br";

interface PagSeguroConfig {
  clientId: string;
  clientSecret: string;
}

function getConfig(): PagSeguroConfig {
  return {
    clientId: process.env.PAGSEGURO_CLIENT_ID || "",
    clientSecret: process.env.PAGSEGURO_CLIENT_SECRET || "",
  };
}

function getApiUrl(): string {
  return PAGSEGURO_API_URL;
}

function getConnectUrl(): string {
  return PAGSEGURO_CONNECT_URL;
}

export function generateAuthorizationUrl(redirectUri: string, state: string): string {
  const config = getConfig();
  const connectUrl = getConnectUrl();
  
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: "payments.read payments.create accounts.read",
    state: state,
  });
  
  return `${connectUrl}/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  accountId?: string;
}> {
  const config = getConfig();
  const apiUrl = getApiUrl();
  
  console.log("[PagSeguro Connect] Exchanging code for token...");
  
  try {
    const response = await axios.post(
      `${apiUrl}/oauth2/token`,
      {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        },
      }
    );
    
    console.log("[PagSeguro Connect] Token obtained successfully");
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      accountId: response.data.account_id,
    };
  } catch (error: any) {
    console.error("[PagSeguro Connect] Error exchanging code:", error.response?.data || error.message);
    throw new Error(`Falha na autorização PagSeguro: ${error.response?.data?.error_description || error.message}`);
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const config = getConfig();
  const apiUrl = getApiUrl();
  
  console.log("[PagSeguro Connect] Refreshing access token...");
  
  try {
    const response = await axios.post(
      `${apiUrl}/oauth2/token`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        },
      }
    );
    
    console.log("[PagSeguro Connect] Token refreshed successfully");
    
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  } catch (error: any) {
    console.error("[PagSeguro Connect] Error refreshing token:", error.response?.data || error.message);
    throw new Error(`Falha ao renovar token PagSeguro: ${error.response?.data?.error_description || error.message}`);
  }
}

interface CreatePixOrderParams {
  orderId: number;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerCpf: string;
  accessToken: string;
  webhookUrl: string;
}

interface PixOrderResponse {
  success: boolean;
  pagseguroOrderId: string;
  pixCode: string;
  pixQrCodeUrl: string;
  expirationDate: string;
}

export async function createPixOrder(params: CreatePixOrderParams): Promise<PixOrderResponse> {
  const {
    orderId,
    amount,
    customerName,
    customerEmail,
    customerCpf,
    accessToken,
    webhookUrl,
  } = params;
  
  const apiUrl = getApiUrl();
  const amountInCents = Math.round(amount * 100);
  
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 1);
  
  const orderPayload = {
    reference_id: `order-${orderId}`,
    customer: {
      name: customerName || "Cliente",
      email: customerEmail,
      tax_id: customerCpf?.replace(/\D/g, "") || "00000000000",
      phones: [{
        country: "55",
        area: "11",
        number: "999999999",
        type: "MOBILE",
      }],
    },
    items: [{
      name: `Pedido #${orderId}`,
      quantity: 1,
      unit_amount: amountInCents,
    }],
    qr_codes: [{
      amount: {
        value: amountInCents,
      },
      expiration_date: expirationDate.toISOString(),
    }],
    notification_urls: [webhookUrl],
  };
  
  console.log(`[PagSeguro Connect] Creating PIX order for order ${orderId}`, {
    amount: amountInCents,
    email: customerEmail,
  });
  
  try {
    const response = await axios.post(
      `${apiUrl}/orders`,
      orderPayload,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const data = response.data;
    const qrCode = data.qr_codes?.[0];
    
    if (!qrCode) {
      throw new Error("QR Code não foi gerado na resposta");
    }
    
    console.log(`[PagSeguro Connect] PIX order created successfully:`, data.id);
    
    return {
      success: true,
      pagseguroOrderId: data.id,
      pixCode: qrCode.text || "",
      pixQrCodeUrl: qrCode.links?.[0]?.href || "",
      expirationDate: qrCode.expiration_date,
    };
  } catch (error: any) {
    console.error("[PagSeguro Connect] Error creating PIX order:", error.response?.data || error.message);
    
    const errorMessage = error.response?.data?.error_messages?.[0]?.description 
      || error.response?.data?.message 
      || error.message;
    
    throw new Error(`Falha ao criar pagamento PIX: ${errorMessage}`);
  }
}

export async function checkOrderStatus(
  pagseguroOrderId: string,
  accessToken: string
): Promise<{
  status: string;
  isPaid: boolean;
}> {
  const apiUrl = getApiUrl();
  
  try {
    const response = await axios.get(
      `${apiUrl}/orders/${pagseguroOrderId}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    const data = response.data;
    const charges = data.charges || [];
    const isPaid = charges.some((charge: any) => charge.status === "PAID");
    
    return {
      status: isPaid ? "PAID" : data.status || "PENDING",
      isPaid,
    };
  } catch (error: any) {
    console.error("[PagSeguro Connect] Error checking order status:", error.response?.data || error.message);
    throw new Error("Falha ao verificar status do pagamento");
  }
}

export function parseWebhook(payload: any): {
  orderId: string | null;
  isPaid: boolean;
  pagseguroOrderId: string | null;
} {
  const referenceId = payload.reference_id || "";
  const orderId = referenceId.replace("order-", "") || null;
  
  const charges = payload.charges || [];
  const isPaid = charges.some((charge: any) => charge.status === "PAID");
  
  return {
    orderId,
    isPaid,
    pagseguroOrderId: payload.id || null,
  };
}
