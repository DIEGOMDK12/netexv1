import axios from "axios";
import fs from "fs";
import path from "path";
import { getValidAccessToken } from "./pagSeguroOAuth";
import { storage } from "./storage";

interface CreatePixPaymentParams {
  orderId: number;
  amount: number;
  email: string;
  description?: string;
  customerCpf?: string;
  customerName?: string;
  resellerPagseguroToken?: string;
  resellerPagseguroEmail?: string;
  resellerPagseguroSandbox?: boolean;
  resellerId?: number;
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

interface SettingsJson {
  pagseguroToken?: string;
  pagseguroEmail?: string;
  pagseguroSandbox?: boolean;
  [key: string]: any;
}

function readSettingsFromFile(): SettingsJson {
  const SETTINGS_FILE = path.join(process.cwd(), "settings.json");
  try {
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("[PagSeguro] Error reading settings file:", error);
    return {};
  }
}

function getPagSeguroConfig() {
  const settings = readSettingsFromFile();
  
  const pagseguroToken = process.env.PAGSEGURO_TOKEN || settings.pagseguroToken;
  const pagseguroEmail = process.env.PAGSEGURO_EMAIL || settings.pagseguroEmail;
  const pagseguroSandbox = settings.pagseguroSandbox ?? true;
  
  return { pagseguroToken, pagseguroEmail, pagseguroSandbox };
}

function formatTaxId(cpf?: string): string {
  if (!cpf) return "12345678909";
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length === 11 || cleanCpf.length === 14) {
    return cleanCpf;
  }
  return "12345678909";
}

async function getTokenForPayment(params: CreatePixPaymentParams): Promise<{
  token: string;
  isSandbox: boolean;
  source: 'oauth' | 'manual' | 'default';
}> {
  if (params.resellerId) {
    const oauthToken = await getValidAccessToken(params.resellerId);
    if (oauthToken) {
      const settings = await storage.getSettings();
      const isSandbox = settings?.pagseguroSandbox ?? true;
      console.log(`[PagSeguro] Using OAuth token for reseller ${params.resellerId}`);
      return { token: oauthToken, isSandbox, source: 'oauth' };
    }
  }

  if (params.resellerPagseguroToken) {
    console.log(`[PagSeguro] Using manual reseller token`);
    return {
      token: params.resellerPagseguroToken,
      isSandbox: params.resellerPagseguroSandbox ?? true,
      source: 'manual'
    };
  }

  const defaultConfig = getPagSeguroConfig();
  if (defaultConfig.pagseguroToken) {
    console.log(`[PagSeguro] Using default token from settings`);
    return {
      token: defaultConfig.pagseguroToken,
      isSandbox: defaultConfig.pagseguroSandbox ?? true,
      source: 'default'
    };
  }

  throw new Error("Token do PagSeguro nao configurado. Configure nas configuracoes do admin ou conecte sua conta PagSeguro.");
}

export async function createPixPayment(params: CreatePixPaymentParams) {
  const { orderId, amount, email, description, customerCpf, customerName } = params;

  const { token: pagseguroToken, isSandbox } = await getTokenForPayment(params);

  const baseUrl = isSandbox 
    ? "https://sandbox.api.pagseguro.com" 
    : "https://api.pagseguro.com";

  const amountInCents = Math.round(amount * 100);
  const taxId = formatTaxId(customerCpf);

  const orderPayload = {
    reference_id: `order-${orderId}`,
    customer: {
      name: customerName || email.split("@")[0] || "Cliente",
      email: email,
      tax_id: taxId,
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
    tokenLength: pagseguroToken.length,
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
      throw new Error("QR Code nao retornado pelo PagSeguro");
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

interface CheckPaymentStatusParams {
  pagseguroOrderId: string;
  resellerPagseguroToken?: string;
  resellerPagseguroSandbox?: boolean;
  resellerId?: number;
}

export async function checkPaymentStatus(params: CheckPaymentStatusParams | string) {
  const isLegacyCall = typeof params === 'string';
  const pagseguroOrderId = isLegacyCall ? params : params.pagseguroOrderId;
  const resellerToken = isLegacyCall ? undefined : params.resellerPagseguroToken;
  const resellerSandbox = isLegacyCall ? undefined : params.resellerPagseguroSandbox;
  const resellerId = isLegacyCall ? undefined : params.resellerId;

  let pagseguroToken: string | undefined;
  let isSandbox = true;

  if (resellerId) {
    const oauthToken = await getValidAccessToken(resellerId);
    if (oauthToken) {
      const settings = await storage.getSettings();
      pagseguroToken = oauthToken;
      isSandbox = settings?.pagseguroSandbox ?? true;
      console.log(`[PagSeguro] Using OAuth token for status check, reseller ${resellerId}`);
    }
  }

  if (!pagseguroToken) {
    const defaultConfig = getPagSeguroConfig();
    pagseguroToken = resellerToken || defaultConfig.pagseguroToken;
    isSandbox = resellerToken 
      ? (resellerSandbox ?? true) 
      : (defaultConfig.pagseguroSandbox ?? true);
  }

  if (!pagseguroToken) {
    throw new Error("Configuracoes do PagSeguro nao encontradas");
  }

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
