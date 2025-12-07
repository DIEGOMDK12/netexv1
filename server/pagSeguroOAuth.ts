import axios from "axios";
import { storage } from "./storage";

interface PagSeguroOAuthConfig {
  clientId: string;
  appAccountId: string;
  isSandbox: boolean;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  account_id: string;
}

async function getOAuthConfig(): Promise<PagSeguroOAuthConfig | null> {
  const settings = await storage.getSettings();
  if (!settings?.pagseguroClientId) {
    return null;
  }
  return {
    clientId: settings.pagseguroClientId,
    appAccountId: settings.pagseguroAppAccountId || "",
    isSandbox: settings.pagseguroSandbox ?? true,
  };
}

function getBaseUrl(isSandbox: boolean): string {
  return isSandbox 
    ? "https://sandbox.api.pagseguro.com" 
    : "https://api.pagseguro.com";
}

function getAuthUrl(isSandbox: boolean): string {
  return isSandbox
    ? "https://connect.sandbox.pagseguro.uol.com.br/oauth2/authorize"
    : "https://connect.pagseguro.uol.com.br/oauth2/authorize";
}

export async function getConnectUrl(resellerId: number, redirectUri: string): Promise<string | null> {
  const config = await getOAuthConfig();
  if (!config) {
    console.error("[PagSeguro OAuth] Client ID not configured");
    return null;
  }

  const authUrl = getAuthUrl(config.isSandbox);
  
  const state = Buffer.from(JSON.stringify({ resellerId })).toString("base64");
  
  const scopes = [
    "payments.read",
    "payments.create",
    "orders.read",
    "orders.create",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: state,
  });

  return `${authUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<TokenResponse | null> {
  const config = await getOAuthConfig();
  if (!config) {
    console.error("[PagSeguro OAuth] Client ID not configured");
    return null;
  }

  const baseUrl = getBaseUrl(config.isSandbox);

  try {
    const response = await axios.post<TokenResponse>(
      `${baseUrl}/oauth2/token`,
      {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("[PagSeguro OAuth] Token obtained successfully");
    return response.data;
  } catch (error: any) {
    console.error("[PagSeguro OAuth] Error exchanging code for token:", 
      error.response?.data || error.message);
    return null;
  }
}

export async function refreshAccessToken(resellerId: number): Promise<boolean> {
  const reseller = await storage.getReseller(resellerId);
  if (!reseller?.pagseguroRefreshToken) {
    console.error("[PagSeguro OAuth] No refresh token found for reseller", resellerId);
    return false;
  }

  const config = await getOAuthConfig();
  if (!config) {
    console.error("[PagSeguro OAuth] Client ID not configured");
    return false;
  }

  const baseUrl = getBaseUrl(config.isSandbox);

  try {
    const response = await axios.post<TokenResponse>(
      `${baseUrl}/oauth2/token`,
      {
        grant_type: "refresh_token",
        refresh_token: reseller.pagseguroRefreshToken,
        client_id: config.clientId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const expiresAt = new Date(Date.now() + response.data.expires_in * 1000);

    await storage.updateReseller(resellerId, {
      pagseguroAccessToken: response.data.access_token,
      pagseguroRefreshToken: response.data.refresh_token,
      pagseguroTokenExpiresAt: expiresAt,
    });

    console.log("[PagSeguro OAuth] Token refreshed successfully for reseller", resellerId);
    return true;
  } catch (error: any) {
    console.error("[PagSeguro OAuth] Error refreshing token:", 
      error.response?.data || error.message);
    
    await storage.updateReseller(resellerId, {
      pagseguroConnected: false,
      pagseguroAccessToken: null,
      pagseguroRefreshToken: null,
      pagseguroTokenExpiresAt: null,
    });
    return false;
  }
}

export async function getValidAccessToken(resellerId: number): Promise<string | null> {
  const reseller = await storage.getReseller(resellerId);
  
  if (!reseller?.pagseguroAccessToken || !reseller.pagseguroConnected) {
    return null;
  }

  if (reseller.pagseguroTokenExpiresAt) {
    const expiresAt = new Date(reseller.pagseguroTokenExpiresAt);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000;
    
    if (now.getTime() >= expiresAt.getTime() - bufferTime) {
      console.log("[PagSeguro OAuth] Token expired or expiring soon, refreshing...");
      const refreshed = await refreshAccessToken(resellerId);
      if (!refreshed) {
        return null;
      }
      
      const updatedReseller = await storage.getReseller(resellerId);
      return updatedReseller?.pagseguroAccessToken || null;
    }
  }

  return reseller.pagseguroAccessToken;
}

export async function disconnectPagSeguro(resellerId: number): Promise<boolean> {
  try {
    await storage.updateReseller(resellerId, {
      pagseguroConnected: false,
      pagseguroAccessToken: null,
      pagseguroRefreshToken: null,
      pagseguroTokenExpiresAt: null,
      pagseguroAccountId: null,
    });
    console.log("[PagSeguro OAuth] Disconnected PagSeguro for reseller", resellerId);
    return true;
  } catch (error) {
    console.error("[PagSeguro OAuth] Error disconnecting:", error);
    return false;
  }
}

export async function saveOAuthTokens(
  resellerId: number,
  tokens: TokenResponse
): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    
    await storage.updateReseller(resellerId, {
      pagseguroAccessToken: tokens.access_token,
      pagseguroRefreshToken: tokens.refresh_token,
      pagseguroTokenExpiresAt: expiresAt,
      pagseguroAccountId: tokens.account_id,
      pagseguroConnected: true,
      preferredPaymentMethod: "pagseguro",
    });

    console.log("[PagSeguro OAuth] Tokens saved for reseller", resellerId);
    return true;
  } catch (error) {
    console.error("[PagSeguro OAuth] Error saving tokens:", error);
    return false;
  }
}
