import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated as isCustomerAuthenticated } from "./replitAuth";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { Client as ObjectStorageClient } from "@replit/object-storage";
import { sendDeliveryEmail } from "./email";
import {
  generateAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  createPixOrder,
  checkOrderStatus,
  parseWebhook as parsePagseguroWebhook,
} from "./pagseguroConnectController";

let objectStorage: ObjectStorageClient | null = null;
let objectStorageInitialized = false;

async function getObjectStorage(): Promise<ObjectStorageClient | null> {
  if (objectStorageInitialized) {
    return objectStorage;
  }
  
  try {
    objectStorage = new ObjectStorageClient();
    await objectStorage.list();
    objectStorageInitialized = true;
    console.log("[Object Storage] Initialized successfully");
    return objectStorage;
  } catch (error: any) {
    console.log("[Object Storage] Not available, using local storage fallback:", error.message);
    objectStorageInitialized = true;
    objectStorage = null;
    return null;
  }
}

const uploadDir = path.join(process.cwd(), "uploads");

// CORREÇÃO 1: Função robusta para garantir que a pasta de uploads exista
function ensureUploadDir(): boolean {
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
      console.log("[Upload] Pasta de uploads criada:", uploadDir);
    }
    // Verificar se temos permissão de escrita
    fs.accessSync(uploadDir, fs.constants.W_OK);
    return true;
  } catch (error: any) {
    console.error("[Upload] ERRO AO CRIAR/ACESSAR PASTA:", {
      path: uploadDir,
      error: error.message,
      code: error.code
    });
    return false;
  }
}

// Criar pasta ao iniciar
ensureUploadDir();

// Imagem padrão para produtos sem imagem
const DEFAULT_PRODUCT_IMAGE = "/assets/default-product.svg";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP."));
    }
  },
});

const ADMIN_USERNAME = "Diegomdk";
const ADMIN_PASSWORD = "506731Diego#";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const adminTokens = new Set<string>();
const vendorTokens = new Map<number, string>();
const tokenToVendor = new Map<string, number>();

// Generate deterministic admin token based on credentials (valid for the session)
const VALID_ADMIN_TOKEN = crypto
  .createHash("sha256")
  .update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`)
  .digest("hex");

function isAuthenticated(token: string | undefined): boolean {
  // Accept hardcoded valid token (deterministic) or any token generated in this session
  return token ? (token === VALID_ADMIN_TOKEN || adminTokens.has(token)) : false;
}

// Cache for vendor sessions to reduce database queries (5 minute TTL)
const vendorSessionCache = new Map<string, { resellerId: number; expiresAt: number }>();

async function isVendorAuthenticatedAsync(token: string | undefined): Promise<{ valid: boolean; resellerId?: number }> {
  if (!token) return { valid: false };
  
  // Check memory cache first
  const cached = vendorSessionCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { valid: true, resellerId: cached.resellerId };
  }
  
  // Also check in-memory maps for backwards compatibility (existing sessions)
  if (tokenToVendor.has(token)) {
    return { valid: true, resellerId: tokenToVendor.get(token) };
  }
  
  // Check database for persistent session
  try {
    const session = await storage.getVendorSession(token);
    if (session) {
      // Cache the session for 5 minutes
      vendorSessionCache.set(token, { 
        resellerId: session.resellerId, 
        expiresAt: Date.now() + 5 * 60 * 1000 
      });
      // Also add to in-memory maps for backwards compatibility
      vendorTokens.set(session.resellerId, token);
      tokenToVendor.set(token, session.resellerId);
      return { valid: true, resellerId: session.resellerId };
    }
  } catch (error: any) {
    console.error("[Auth] Error checking vendor session:", error.message);
  }
  
  return { valid: false };
}

// Synchronous version - validates expiry from cache (call async version for full DB check)
function isVendorAuthenticated(token: string | undefined): boolean {
  if (!token) return false;
  
  // Check cache first with expiry validation
  const cached = vendorSessionCache.get(token);
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      return true;
    } else {
      // Session expired - clean up
      vendorSessionCache.delete(token);
      tokenToVendor.delete(token);
      return false;
    }
  }
  
  // Fall back to in-memory maps (for tokens created before DB persistence was added)
  // These don't have expiry info, so they remain valid until server restart
  return tokenToVendor.has(token);
}

function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

function readSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("[Settings] Error reading settings file:", error);
    return {
      storeName: "GOLDNET",
      logoUrl: "",
      themeColor: "#3B82F6",
      textColor: "#FFFFFF",
      pixKey: "",
      adminPixKey: "973.182.722-68",
      resellerPixKey: "",
      pagseguroToken: "",
      pagseguroEmail: "",
      pagseguroSandbox: false,
      pagseguroApiUrl: "https://api.pagseguro.com",
      supportEmail: "suporte@goldnet.com",
      whatsappContact: "5585988007000",
      resellerWhatsapp: ""
    };
  }
}

function writeSettings(data: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
    console.log("[Settings] Settings saved successfully");
    return true;
  } catch (error) {
    console.error("[Settings] Error writing settings file:", error);
    return false;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve uploaded files statically
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadDir));

  // Setup customer authentication (Google, GitHub, Apple, etc)
  await setupAuth(app);

  // ============== DOMAIN LOOKUP API (White Label) ==============
  // Returns reseller info for a custom domain
  app.get("/api/domain/lookup", async (req, res) => {
    const host = (req.query.domain as string) || req.headers.host?.toLowerCase().replace(/:\d+$/, "") || "";
    
    // Check if it's a main domain
    const mainDomains = ["goldnetsteam.shop", "localhost", "127.0.0.1", "0.0.0.0"];
    const isMainDomain = mainDomains.some((d) => host === d || host.endsWith(`.replit.dev`) || host.endsWith(`.repl.co`));
    
    if (isMainDomain) {
      return res.json({ isCustomDomain: false, reseller: null });
    }
    
    try {
      const reseller = await storage.getResellerByDomain(host);
      if (reseller) {
        return res.json({
          isCustomDomain: true,
          reseller: {
            id: reseller.id,
            slug: reseller.slug,
            storeName: reseller.storeName || reseller.name,
            logoUrl: reseller.logoUrl,
            themeColor: reseller.themeColor,
            backgroundColor: reseller.backgroundColor,
          }
        });
      }
      return res.json({ isCustomDomain: false, reseller: null });
    } catch (error) {
      console.error("[Domain Lookup] Error:", error);
      return res.json({ isCustomDomain: false, reseller: null });
    }
  });

  // ============== WEBHOOK ABACATEPAY - ROTA PRINCIPAL (goldnetsteam.shop/webhook) ==============
  // CORS configurado para aceitar requisições externas do AbacatePay
  app.options("/webhook", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Signature, X-Abacatepay-Signature");
    res.status(200).end();
  });

  app.post("/webhook", async (req, res) => {
    // CORS headers para requisições externas
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Signature, X-Abacatepay-Signature");

    // DEBUG: Log no início da rota
    console.log('Webhook recebido em /webhook:', req.body?.event);
    console.log("==========================================");
    console.log("[/webhook] PAYLOAD COMPLETO:", JSON.stringify(req.body, null, 2));
    console.log("==========================================");

    try {
      const payload = req.body;
      const event = payload?.event || payload?.eventType || "";

      // Verificar se é evento de pagamento confirmado (billing.paid)
      const isPaid = event === "billing.paid" || 
                     event === "BILLING.PAID" ||
                     event === "payment.confirmed" ||
                     event === "PAYMENT.CONFIRMED" ||
                     event === "pixQrCode.paid" ||
                     event === "PIXQRCODE.PAID";

      console.log("[/webhook] Evento:", event, "| isPaid:", isPaid);

      if (!isPaid) {
        console.log("[/webhook] Evento ignorado (não é pagamento confirmado)");
        return res.status(200).json({ success: true, message: "Webhook processado - evento ignorado" });
      }

      // ========== LOCALIZAR PEDIDO ==========
      let order = null;
      let orderId: number | null = null;
      let metodoEncontrado = "";

      // Extrair billing_id do payload (pode estar em diferentes locais)
      const billingId = payload.data?.id || 
                        payload.data?.billing?.id || 
                        payload.data?.pixQrCode?.id ||
                        payload.billingId ||
                        payload.id;

      console.log("[/webhook] billing_id extraído:", billingId);

      if (billingId) {
        // Buscar pedido onde abacatepayBillingId == billing_id
        const allOrders = await storage.getOrders();
        const matchedOrder = allOrders.find((o: any) => o.abacatepayBillingId === billingId);
        
        if (matchedOrder) {
          order = matchedOrder;
          orderId = matchedOrder.id;
          metodoEncontrado = "billing_id";
          console.log("[/webhook] ✓ Pedido encontrado por billing_id! OrderId:", orderId);
        } else {
          console.log("[/webhook] Nenhum pedido com billing_id:", billingId);
        }
      }

      // MÉTODO SECUNDÁRIO: Buscar pelo order_id nos metadados
      if (!order) {
        const metadataOrderId = payload.data?.metadata?.order_id ||
                                payload.data?.metadata?.orderId ||
                                payload.data?.billing?.metadata?.order_id ||
                                payload.data?.billing?.metadata?.orderId ||
                                payload.metadata?.order_id ||
                                payload.metadata?.orderId;

        console.log("[/webhook] metadata.order_id extraído:", metadataOrderId);

        if (metadataOrderId) {
          orderId = parseInt(metadataOrderId);
          order = await storage.getOrder(orderId);
          if (order) {
            metodoEncontrado = "metadata.order_id";
            console.log("[/webhook] ✓ Pedido encontrado por metadata.order_id! OrderId:", orderId);
          }
        }
      }

      // MÉTODO TERCIÁRIO: Buscar pelo externalId do produto (formato: "order-123")
      if (!order) {
        const externalId = payload.data?.billing?.products?.[0]?.externalId ||
                           payload.data?.products?.[0]?.externalId;
        
        console.log("[/webhook] externalId extraído:", externalId);

        if (externalId && externalId.startsWith("order-")) {
          orderId = parseInt(externalId.replace("order-", ""));
          order = await storage.getOrder(orderId);
          if (order) {
            metodoEncontrado = "externalId";
            console.log("[/webhook] ✓ Pedido encontrado por externalId! OrderId:", orderId);
          }
        }
      }

      // Se não encontrou o pedido, retornar 200 mesmo assim
      if (!order || !orderId) {
        console.error("[/webhook] ❌ PEDIDO NÃO ENCONTRADO - billing_id:", billingId);
        console.error("[/webhook] Payload completo:", JSON.stringify(payload, null, 2));
        return res.status(200).json({ success: true, message: "Webhook processado - pedido não encontrado" });
      }

      console.log("[/webhook] Pedido localizado:", {
        id: order.id,
        status_atual: order.status,
        metodo: metodoEncontrado
      });

      // Verificar se já foi processado
      if (order.status === "paid" || order.status === "approved") {
        console.log("[/webhook] Pedido já pago, ignorando duplicata");
        return res.status(200).json({ success: true, message: "Webhook processado - pedido já pago" });
      }

      // ========== ATUALIZAR STATUS PARA 'approved' E 'paid' ==========
      console.log("[/webhook] >>> ATUALIZANDO STATUS PARA 'approved' e 'paid' <<<");
      
      await storage.updateOrder(orderId, {
        status: "paid",
      });

      // Verificar se salvou
      const orderAtualizado = await storage.getOrder(orderId);
      console.log("[/webhook] ✓ STATUS ATUALIZADO! Novo status:", orderAtualizado?.status);

      if (orderAtualizado?.status !== "paid") {
        console.error("[/webhook] ❌ FALHA CRÍTICA: Status não foi atualizado!");
      }

      // ========== EXECUTAR LÓGICA DE ENTREGA (CRÍTICO) ==========
      // Retirar Key do estoque e salvar no pedido
      let deliveredContent = "";
      
      try {
        const orderItems = await storage.getOrderItems(orderId);
        
        for (const item of orderItems) {
          const product = await storage.getProduct(item.productId);
          const quantity = item.quantity || 1;
          let itemDeliveredContent = "";

          if (product && product.stock) {
            const stockLines = product.stock.split("\n").filter((line: string) => line.trim());

            if (stockLines.length >= quantity) {
              // FIFO: Retirar keys do estoque
              for (let i = 0; i < quantity; i++) {
                deliveredContent += stockLines[i] + "\n";
                itemDeliveredContent += stockLines[i] + "\n";
              }
              const remainingStock = stockLines.slice(quantity).join("\n");
              await storage.updateProduct(item.productId, { stock: remainingStock });
              console.log("[/webhook] ✓ Entregue:", quantity, "item(s) de", product.name);
              console.log("[/webhook] ✓ Estoque restante:", stockLines.length - quantity, "linhas");
              
              // Atualizar item com conteúdo entregue
              if (itemDeliveredContent.trim()) {
                await storage.updateOrderItem(item.id, { deliveredContent: itemDeliveredContent.trim() });
                console.log("[/webhook] ✓ Item", item.id, "atualizado com conteúdo entregue");
              }
            } else {
              console.warn("[/webhook] ⚠️ Estoque insuficiente para", product.name);
            }
          }
        }

        // Salvar conteúdo entregue no pedido
        if (deliveredContent.trim()) {
          const settings = readSettings();
          const storeName = settings?.storeName || "GOLDNET";
          const whatsappMessage = `Olá! Pagamento confirmado. Pedido #${orderId}:\n\n${deliveredContent.trim()}`;
          const whatsappLink = order.whatsapp 
            ? generateWhatsAppLink(order.whatsapp, whatsappMessage)
            : null;

          await storage.updateOrder(orderId, {
            deliveredContent: deliveredContent.trim(),
            whatsappDeliveryLink: whatsappLink,
          });
          console.log("[/webhook] ✓ Conteúdo entregue salvo no pedido");
        }
      } catch (deliveryError: any) {
        console.error("[/webhook] Erro na entrega (status já salvo):", deliveryError.message);
      }

      // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
      try {
        if (order.resellerId) {
          const reseller = await storage.getReseller(order.resellerId);
          if (reseller) {
            const valorVenda = parseFloat(order.totalAmount as string || "0");
            const currentBalance = parseFloat(reseller.walletBalance as string || "0");
            
            // Calcular taxa de 10% para produtos premium
            const orderItemsForFee = await storage.getOrderItems(orderId);
            let taxaPremium = 0;
            
            for (const item of orderItemsForFee) {
              const product = await storage.getProduct(item.productId);
              if (product && product.isPremium) {
                const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                taxaPremium += itemValue * 0.10; // 10% de taxa
              }
            }
            
            // Valor líquido = valor da venda - taxa premium
            const valorLiquido = valorVenda - taxaPremium;
            const newBalance = currentBalance + valorLiquido;

            await storage.updateReseller(order.resellerId, {
              walletBalance: newBalance.toFixed(2),
              totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
              totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
            });
            
            if (taxaPremium > 0) {
              console.log(`[/webhook] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
              console.log(`[/webhook] ✓ Valor líquido revendedor: R$ ${valorLiquido.toFixed(2)}`);
            }
            console.log("[/webhook] ✓ Saldo revendedor atualizado:", newBalance.toFixed(2));
          }
        }
      } catch (walletError: any) {
        console.error("[/webhook] Erro ao atualizar saldo (status já salvo):", walletError.message);
      }

      // ========== ENVIAR EMAIL DE ENTREGA ==========
      try {
        if (order.email && deliveredContent.trim()) {
          const orderItems = await storage.getOrderItems(orderId);
          const productNames = orderItems.map((item: any) => item.productName || "Produto Digital").join(", ");
          const settings = readSettings();
          const storeName = settings?.storeName || "GOLDNET";

          console.log("[/webhook] Enviando email para:", order.email);
          
          const emailResult = await sendDeliveryEmail({
            to: order.email,
            orderId,
            productName: productNames,
            deliveredContent: deliveredContent.trim(),
            storeName,
          });
          
          if (emailResult.success) {
            console.log("[/webhook] ✓ Email enviado com sucesso");
          } else {
            console.error("[/webhook] Erro no email (ignorado):", emailResult.error);
          }
        }
      } catch (emailError: any) {
        console.error("[/webhook] Erro de email (ignorado):", emailError.message);
      }

      console.log("==========================================");
      console.log("[/webhook] PEDIDO", orderId, "PROCESSADO COM SUCESSO!");
      console.log("==========================================");

      // ========== RESPOSTA FINAL - STATUS 200 PARA ABACATEPAY ==========
      return res.status(200).json({ 
        success: true, 
        message: "Webhook processado com sucesso",
        orderId: orderId,
        status: "paid"
      });

    } catch (error: any) {
      console.error("[/webhook] ERRO CRÍTICO:", error.message);
      console.error("[/webhook] Stack:", error.stack);
      // Mesmo com erro, retornar 200 para o AbacatePay não reenviar
      return res.status(200).json({ success: true, message: "Webhook processado" });
    }
  });
  // ============== FIM WEBHOOK /webhook ==============

  // Customer auth user endpoint
  app.get('/api/auth/user', isCustomerAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getCustomerUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching customer user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.use("/uploads", (await import("express")).default.static(uploadDir));

  app.get("/uploads/:filename", async (req, res, next) => {
    const filename = req.params.filename;
    
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.log("[GET /uploads] Invalid filename (path traversal attempt):", filename);
      return res.status(400).json({ error: "Nome de arquivo inválido" });
    }
    
    const localPath = path.join(uploadDir, filename);
    
    const resolvedPath = path.resolve(localPath);
    if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
      console.log("[GET /uploads] Path traversal blocked:", filename);
      return res.status(400).json({ error: "Nome de arquivo inválido" });
    }
    
    if (fs.existsSync(localPath)) {
      return next();
    }
    
    try {
      const storage = await getObjectStorage();
      if (!storage) {
        console.log("[GET /uploads] Object storage not available and file not found locally");
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      
      const objectKey = `uploads/${filename}`;
      console.log("[GET /uploads] File not found locally, checking object storage:", objectKey);
      
      const result = await storage.downloadAsBytes(objectKey);
      if (!result.ok) {
        console.log("[GET /uploads] Image not found in object storage either:", objectKey);
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(result.value);
    } catch (error: any) {
      console.error("[GET /uploads] Error fetching from object storage:", error);
      res.status(500).json({ error: "Erro ao buscar imagem" });
    }
  });

  app.get("/api/images/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        console.log("[GET /api/images] Invalid filename (path traversal attempt):", filename);
        return res.status(400).json({ error: "Nome de arquivo inválido" });
      }
      
      const localPath = path.join(uploadDir, filename);
      
      const resolvedPath = path.resolve(localPath);
      if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
        console.log("[GET /api/images] Path traversal blocked:", filename);
        return res.status(400).json({ error: "Nome de arquivo inválido" });
      }
      
      if (fs.existsSync(localPath)) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.sendFile(localPath);
      }
      
      const storage = await getObjectStorage();
      if (!storage) {
        console.log("[GET /api/images] Object storage not available and file not found locally");
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      
      const objectKey = `uploads/${filename}`;
      console.log("[GET /api/images] Fetching image from object storage:", objectKey);
      
      const result = await storage.downloadAsBytes(objectKey);
      if (!result.ok) {
        console.log("[GET /api/images] Image not found in object storage:", objectKey);
        return res.status(404).json({ error: "Imagem não encontrada" });
      }
      
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(result.value);
    } catch (error: any) {
      console.error("[GET /api/images] Error:", error);
      res.status(500).json({ error: "Erro ao buscar imagem" });
    }
  });

  // CORREÇÃO 2: Endpoint de upload blindado com fallbacks
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      
      // Use async authentication to check database for persistent sessions
      const vendorAuth = await isVendorAuthenticatedAsync(token);
      if (!isAuthenticated(token) && !vendorAuth.valid) {
        console.log("[POST /api/upload] Unauthorized upload attempt");
        return res.status(401).json({ error: "Não autorizado. Faça login para fazer upload de imagens." });
      }

      // Se não tem arquivo, retorna imagem padrão em vez de erro
      if (!req.file) {
        console.log("[POST /api/upload] Nenhum arquivo enviado, retornando imagem padrão");
        return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true });
      }

      // Garantir que a pasta existe antes de salvar
      if (!ensureUploadDir()) {
        console.error("[POST /api/upload] ERRO UPLOAD: Pasta de destino inacessível");
        // Fallback: retorna imagem padrão em vez de erro 500
        return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true, warning: "Pasta de upload inacessível" });
      }

      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const filename = uniqueSuffix + ext;
      
      const objStorage = await getObjectStorage();
      
      if (objStorage) {
        const objectKey = `uploads/${filename}`;
        console.log("[POST /api/upload] Uploading to object storage:", objectKey);
        
        try {
          const uploadResult = await objStorage.uploadFromBytes(objectKey, req.file.buffer);
          
          if (!uploadResult.ok) {
            console.error("[POST /api/upload] ERRO UPLOAD Object Storage:", uploadResult.error);
            // Fallback para storage local
            try {
              fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
              const imageUrl = `/uploads/${filename}`;
              console.log("[POST /api/upload] Fallback to local storage:", imageUrl);
              return res.json({ imageUrl });
            } catch (localError: any) {
              console.error("[POST /api/upload] ERRO UPLOAD Local também falhou:", localError.message);
              return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true });
            }
          }
          
          const imageUrl = `/api/images/${filename}`;
          console.log("[POST /api/upload] Image uploaded to object storage:", imageUrl);
          return res.json({ imageUrl });
        } catch (objStorageError: any) {
          console.error("[POST /api/upload] ERRO UPLOAD Exception Object Storage:", {
            message: objStorageError.message,
            code: objStorageError.code,
            stack: objStorageError.stack
          });
          // Tentar fallback local
          try {
            fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
            const imageUrl = `/uploads/${filename}`;
            console.log("[POST /api/upload] Fallback to local storage após erro:", imageUrl);
            return res.json({ imageUrl });
          } catch (localError: any) {
            console.error("[POST /api/upload] ERRO UPLOAD Local também falhou:", localError.message);
            return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true });
          }
        }
      } else {
        // Sem object storage, salvar localmente
        try {
          fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
          const imageUrl = `/uploads/${filename}`;
          console.log("[POST /api/upload] Image saved to local storage:", imageUrl);
          return res.json({ imageUrl });
        } catch (localError: any) {
          console.error("[POST /api/upload] ERRO UPLOAD Local:", {
            message: localError.message,
            code: localError.code,
            path: path.join(uploadDir, filename)
          });
          return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true });
        }
      }
    } catch (error: any) {
      // CORREÇÃO 3: Log detalhado de erro
      console.error("[POST /api/upload] ERRO UPLOAD CRÍTICO:", {
        message: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        path: error.path,
        stack: error.stack
      });
      // Retorna imagem padrão em vez de erro 500
      return res.json({ imageUrl: DEFAULT_PRODUCT_IMAGE, isDefault: true, error: "Erro no upload" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getValidProducts();
      console.log("[GET /api/products] Returning", products.length, "valid products (with active reseller)");
      res.json(products);
    } catch (error: any) {
      console.error("[GET /api/products] Error:", error.message, error.stack);
      res.status(500).json({ error: "Failed to fetch products", details: error.message });
    }
  });

  // MARKETPLACE: Get all products with seller info (global home page)
  app.get("/api/marketplace/products", async (req, res) => {
    try {
      console.log("[GET /api/marketplace/products] Fetching all products with seller info...");
      const productsWithSellers = await storage.getProductsWithSellers();
      console.log("[GET /api/marketplace/products] Returning", productsWithSellers.length, "products with seller info");
      res.json(productsWithSellers);
    } catch (error: any) {
      console.error("[GET /api/marketplace/products] Error:", error.message, error.stack);
      res.status(500).json({ error: "Failed to fetch marketplace products", details: error.message });
    }
  });

  // Get batch seller stats for marketplace product cards
  app.post("/api/marketplace/seller-stats", async (req, res) => {
    try {
      const { sellerIds } = req.body;
      if (!Array.isArray(sellerIds) || sellerIds.length === 0) {
        return res.json({});
      }
      const stats = await storage.getBatchSellerStats(sellerIds.map(Number));
      res.json(stats);
    } catch (error: any) {
      console.error("[POST /api/marketplace/seller-stats] Error:", error.message);
      res.status(500).json({ error: "Failed to fetch seller stats" });
    }
  });

  // Get global unique categories (for marketplace home) - only fixed categories
  app.get("/api/marketplace/categories", async (req, res) => {
    try {
      console.log("[GET /api/marketplace/categories] Fetching fixed global categories...");
      const cats = await storage.getCategories();
      // Fixed category slugs that should be shown (marketplace categories)
      const fixedCategorySlugs = [
        "games-mobile",
        "games-pc",
        "steam-plataformas",
        "streaming",
        "cursos",
        "softwares"
      ];
      // Filter only active fixed categories (no resellerId) and sort by displayOrder
      const globalCats = cats
        .filter((c: any) => !c.resellerId && c.active && fixedCategorySlugs.includes(c.slug))
        .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
      console.log("[GET /api/marketplace/categories] Returning", globalCats.length, "marketplace categories");
      res.json(globalCats);
    } catch (error: any) {
      console.error("[GET /api/marketplace/categories] Error:", error.message, error.stack);
      res.status(500).json({ error: "Failed to fetch categories", details: error.message });
    }
  });

  app.post("/api/admin/sanitize-products", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      console.log("[Sanitize] Admin requested product cleanup");
      const result = await storage.sanitizeOrphanProducts();
      console.log("[Sanitize] Cleanup completed:", result);
      res.json({ 
        success: true, 
        message: `Removed ${result.deleted} orphan products`,
        ...result 
      });
    } catch (error: any) {
      console.error("[Sanitize] Error:", error);
      res.status(500).json({ error: "Failed to sanitize products", details: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product || !product.resellerId || !product.active) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("[GET /api/products/:id] Error:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/settings", (req, res) => {
    console.log("[GET /api/settings] Reading from settings.json");
    const settings = readSettings();
    const { pagseguroToken, ...publicSettings } = settings;
    res.json(publicSettings);
  });

  app.post("/api/settings", (req, res) => {
    console.log("[POST /api/settings] Request received with body:", req.body);
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!isAuthenticated(token)) {
      console.log("[POST /api/settings] Unauthorized - returning 401");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { storeName, logoUrl, themeColor, textColor, pixKey, adminPixKey, resellerPixKey, pagseguroToken, pagseguroEmail, pagseguroSandbox, pagseguroApiUrl, supportEmail, whatsappContact, resellerWhatsapp } = req.body;
    const currentSettings = readSettings();
    
    const updatedSettings = {
      storeName: storeName || currentSettings.storeName || "GOLDNET",
      logoUrl: logoUrl || currentSettings.logoUrl || "",
      themeColor: themeColor || currentSettings.themeColor || "#3B82F6",
      textColor: textColor || currentSettings.textColor || "#FFFFFF",
      pixKey: pixKey || currentSettings.pixKey || "",
      adminPixKey: adminPixKey || currentSettings.adminPixKey || "973.182.722-68",
      resellerPixKey: resellerPixKey || currentSettings.resellerPixKey || "",
      pagseguroToken: pagseguroToken || currentSettings.pagseguroToken || "",
      pagseguroEmail: pagseguroEmail || currentSettings.pagseguroEmail || "",
      pagseguroSandbox: false,
      pagseguroApiUrl: "https://api.pagseguro.com",
      supportEmail: supportEmail || currentSettings.supportEmail || "suporte@nexstore.com",
      whatsappContact: whatsappContact || currentSettings.whatsappContact || "5585988007000",
      resellerWhatsapp: resellerWhatsapp || currentSettings.resellerWhatsapp || ""
    };

    const success = writeSettings(updatedSettings);
    
    if (!success) {
      return res.status(500).json({ error: "Failed to save settings" });
    }

    const { pagseguroToken: token2, ...publicSettings } = updatedSettings;
    res.json(publicSettings);
  });

  app.get("/api/admin/orders", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/admin/orders/:id/approve", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    console.log("[POST /api/admin/orders/:id/approve] START - Token:", token ? "present" : "missing");
    
    if (!isAuthenticated(token)) {
      console.log("[POST /api/admin/orders/:id/approve] ❌ Unauthorized");
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const orderId = parseInt(req.params.id);
      console.log("[POST /api/admin/orders/:id/approve] Approving order:", orderId);
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log("[POST /api/admin/orders/:id/approve] ❌ Order not found:", orderId);
        return res.status(404).json({ error: "Order not found" });
      }

      const orderItems = await storage.getOrderItems(orderId);
      let deliveredContent = "";

      // FIFO Logic: Digital products - always 1 unit per item
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        console.log(`[POST /api/admin/orders/:id/approve] Processing item: ${product?.name}`);
        let itemDeliveredContent = "";
        
        if (product && product.stock) {
          const stockLines = product.stock.split("\n").filter(line => line.trim());
          
          // Digital products: Always need at least 1 line for delivery
          if (stockLines.length < 1) {
            console.log(`[POST /api/admin/orders/:id/approve] ❌ No stock for ${product.name}`);
            return res.status(400).json({ 
              error: `Sem estoque disponível para ${product.name}` 
            });
          }
          
          // CRITICAL: Always take ONLY 1 item from stock (digital product rule)
          deliveredContent += stockLines[0] + "\n";
          itemDeliveredContent = stockLines[0];
          console.log(`[POST /api/admin/orders/:id/approve] ✓ Delivered: ${stockLines[0]}`);

          // Remove the first line from stock and update
          const remainingStock = stockLines.slice(1).join("\n");
          await storage.updateProduct(item.productId, { stock: remainingStock });
          console.log(`[POST /api/admin/orders/:id/approve] ✓ Stock updated. Remaining lines: ${stockLines.length - 1}`);
          
          // Update item with delivered content
          if (itemDeliveredContent.trim()) {
            await storage.updateOrderItem(item.id, { deliveredContent: itemDeliveredContent });
            console.log(`[POST /api/admin/orders/:id/approve] ✓ Item ${item.id} updated with delivered content`);
          }
        } else {
          console.log(`[POST /api/admin/orders/:id/approve] ⚠️ Product ${item.productId} has no stock field`);
        }
      }

      // Mark order as paid and save delivered content
      await storage.updateOrder(orderId, {
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });

      // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
      try {
        if (order.resellerId) {
          const reseller = await storage.getReseller(order.resellerId);
          if (reseller) {
            const valorVenda = parseFloat(order.totalAmount as string || "0");
            const currentBalance = parseFloat(reseller.walletBalance as string || "0");
            
            // Calcular taxa de 10% para produtos premium
            let taxaPremium = 0;
            for (const item of orderItems) {
              const product = await storage.getProduct(item.productId);
              if (product && product.isPremium) {
                const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                taxaPremium += itemValue * 0.10; // 10% de taxa
              }
            }
            
            // Valor líquido = valor da venda - taxa premium
            const valorLiquido = valorVenda - taxaPremium;
            const newBalance = currentBalance + valorLiquido;

            await storage.updateReseller(order.resellerId, {
              walletBalance: newBalance.toFixed(2),
              totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
              totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
            });
            
            if (taxaPremium > 0) {
              console.log(`[POST /api/admin/orders/:id/approve] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
            }
            console.log(`[POST /api/admin/orders/:id/approve] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
          }
        }
      } catch (walletError: any) {
        console.error("[POST /api/admin/orders/:id/approve] Erro ao atualizar saldo:", walletError.message);
      }

      // Send delivery email automatically
      if (order.email) {
        const productNames = orderItems.map((item: any) => item.productName || "Produto Digital").join(", ");
        const settings = readSettings();
        
        // Don't block the response, but log properly
        sendDeliveryEmail({
          to: order.email,
          orderId,
          productName: productNames,
          deliveredContent: deliveredContent.trim(),
          storeName: settings?.storeName || "Nossa Loja",
        }).then(result => {
          if (result.success) {
            console.log(`[POST /api/admin/orders/:id/approve] ✓ Email sent to ${order.email}`);
          } else {
            console.error(`[POST /api/admin/orders/:id/approve] ❌ Email failed: ${result.error}`);
          }
        }).catch(err => {
          console.error(`[POST /api/admin/orders/:id/approve] ❌ Email exception:`, err.message);
        });
      } else {
        console.log(`[POST /api/admin/orders/:id/approve] ⚠️ No email provided, skipping delivery email`);
      }

      console.log(`[POST /api/admin/orders/:id/approve] ✓ Order ${orderId} approved successfully`);
      res.json({
        success: true,
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });
    } catch (error) {
      console.error("[POST /api/admin/orders/:id/approve] ❌ CRITICAL ERROR:", (error as any).message);
      console.error("[POST /api/admin/orders/:id/approve] Stack:", (error as any).stack);
      res.status(500).json({ error: "Failed to approve order", details: (error as any).message });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    console.log("\n");
    console.log("█████████████████████████████████████████████████████");
    console.log("[DELETE /api/orders/:id] ===== DELETE REQUEST RECEIVED =====");
    console.log("█████████████████████████████████████████████████████");
    
    const rawId = req.params.id;
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    console.log("[DELETE] req.params:", req.params);
    console.log("[DELETE] rawId:", rawId);
    console.log("[DELETE] rawId Type:", typeof rawId);
    console.log("[DELETE] rawId === undefined?", rawId === undefined);
    console.log("[DELETE] rawId === 'undefined'?", rawId === "undefined");
    console.log("[DELETE] Token present:", !!token);
    console.log("[DELETE] Authorization header:", req.headers.authorization);
    console.log("[DELETE] Token (after Bearer extraction):", token);

    // Validate ID format
    if (!rawId || rawId === "undefined" || isNaN(Number(rawId))) {
      console.log("[DELETE] ❌ ID INVÁLIDO - Retornando 400");
      return res.status(400).json({ error: "ID de pedido inválido (recebido: " + rawId + ")" });
    }

    const orderId = parseInt(rawId, 10);
    console.log("[DELETE] ✓ ID parseado com sucesso:", orderId);

    // Check if vendor or admin is authenticated
    let isVendor = false;
    let vendorId = null;

    // CORRIGIDO: Verificar token usando tokenToVendor Map (não vendorTokens)
    // vendorTokens é Map<number, string> (vendorId -> token)
    // tokenToVendor é Map<string, number> (token -> vendorId)
    if (token && tokenToVendor.has(token)) {
      vendorId = tokenToVendor.get(token);
      isVendor = true;
      console.log("[DELETE /api/orders/:id] ✓ Vendor authenticated. Token matched. VendorID:", vendorId);
    } else if (token && isAuthenticated(token)) {
      console.log("[DELETE /api/orders/:id] ✓ Admin authenticated");
    } else {
      console.log("[DELETE /api/orders/:id] ✗ Not authenticated - token:", token);
      console.log("[DELETE /api/orders/:id] ✗ tokenToVendor size:", tokenToVendor.size);
      console.log("[DELETE /api/orders/:id] ✗ adminTokens size:", adminTokens.size);
      return res.status(401).json({ error: "Não autorizado" });
    }

    try {
      console.log("[DELETE] Buscando pedido:", orderId);
      const order = await storage.getOrder(orderId);

      if (!order) {
        console.log("[DELETE] ❌ Pedido não encontrado:", orderId);
        return res.status(404).json({ error: "Pedido não encontrado (ID: " + orderId + ")" });
      }

      console.log("[DELETE] ✓ Pedido encontrado");
      console.log("[DELETE] Order data:", { id: order.id, resellerId: order.resellerId, status: order.status });

      // If vendor, verify they own this order
      if (isVendor && order.resellerId !== vendorId) {
        console.log("[DELETE] ❌ ACESSO NEGADO. Vendor", vendorId, "tentou deletar pedido de", order.resellerId);
        return res.status(403).json({ error: "Você não tem permissão para deletar este pedido" });
      }

      console.log("[DELETE] Deletando pedido:", orderId);
      const result = await storage.deleteOrder(orderId);
      console.log("[DELETE] Resultado delete:", result);
      
      console.log("[DELETE] ✓ Pedido deletado com sucesso");
      console.log("█████████████████████████████████████████████████████");
      console.log("[DELETE] ===== REQUEST END (SUCCESS) =====");
      console.log("█████████████████████████████████████████████████████\n");
      
      res.json({ success: true, message: "Pedido deletado com sucesso", orderId: orderId });
    } catch (error) {
      console.error("[DELETE] ❌ EXCEÇÃO:", (error as any).message);
      console.error("[DELETE] Stack trace:", (error as any).stack);
      console.log("█████████████████████████████████████████████████████");
      console.log("[DELETE] ===== REQUEST END (ERROR) =====");
      console.log("█████████████████████████████████████████████████████\n");
      res.status(500).json({ error: "Erro ao deletar pedido: " + (error as any).message });
    }
  });

  app.get("/api/coupons/validate", async (req, res) => {
    try {
      const code = req.query.code as string;
      const resellerId = req.query.resellerId ? parseInt(req.query.resellerId as string) : undefined;
      const cartTotal = req.query.cartTotal ? parseFloat(req.query.cartTotal as string) : 0;
      
      if (!code) {
        return res.json({ valid: false });
      }

      const coupon = await storage.getCouponByCode(code.toUpperCase());
      
      if (!coupon || !coupon.active) {
        return res.json({ valid: false, message: "Cupom inválido ou inativo" });
      }

      if (resellerId && coupon.resellerId && coupon.resellerId !== resellerId) {
        return res.json({ valid: false, message: "Este cupom não é válido para esta loja" });
      }

      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res.json({ valid: false, message: "Este cupom já atingiu o limite de uso" });
      }

      if (coupon.minOrderValue && cartTotal < parseFloat(coupon.minOrderValue)) {
        return res.json({ 
          valid: false, 
          message: `Valor mínimo do pedido: R$ ${parseFloat(coupon.minOrderValue).toFixed(2)}` 
        });
      }

      let discountAmount = 0;
      if (coupon.discountType === "percent") {
        const percent = coupon.discountPercent || parseFloat(coupon.discountValue || "0");
        discountAmount = (cartTotal * percent) / 100;
      } else if (coupon.discountType === "fixed") {
        discountAmount = parseFloat(coupon.discountValue || "0");
      }

      res.json({ 
        valid: true, 
        couponId: coupon.id,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountPercent: coupon.discountPercent,
        discountAmount: discountAmount.toFixed(2)
      });
    } catch (error) {
      console.error("[Coupon Validate] Error:", error);
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  app.get("/api/announcement", async (req, res) => {
    try {
      const resellerId = req.query.resellerId ? parseInt(req.query.resellerId as string) : undefined;
      const announcement = await storage.getAnnouncementSettings(resellerId);
      
      if (!announcement || !announcement.enabled) {
        return res.json({ enabled: false });
      }

      res.json({
        enabled: true,
        text: announcement.text,
        backgroundColor: announcement.backgroundColor,
        textColor: announcement.textColor,
      });
    } catch (error) {
      console.error("[Announcement] Error:", error);
      res.status(500).json({ error: "Failed to fetch announcement" });
    }
  });

  app.get("/api/vendor/announcement", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const announcement = await storage.getAnnouncementSettings(vendorId);
      res.json(announcement || { enabled: false, text: "", backgroundColor: "#9333EA", textColor: "#FFFFFF" });
    } catch (error) {
      console.error("[Vendor Announcement GET] Error:", error);
      res.status(500).json({ error: "Failed to fetch announcement" });
    }
  });

  app.post("/api/vendor/announcement", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const { enabled, text, backgroundColor, textColor } = req.body;
      
      const updated = await storage.updateAnnouncementSettings({
        resellerId: vendorId,
        enabled: enabled ?? false,
        text: text || "",
        backgroundColor: backgroundColor || "#9333EA",
        textColor: textColor || "#FFFFFF",
      });

      res.json(updated);
    } catch (error) {
      console.error("[Vendor Announcement POST] Error:", error);
      res.status(500).json({ error: "Failed to update announcement" });
    }
  });

  app.get("/api/vendor/coupons", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const vendorCoupons = await storage.getResellerCoupons(vendorId!);
      res.json(vendorCoupons);
    } catch (error) {
      console.error("[Vendor Coupons GET] Error:", error);
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  app.post("/api/vendor/coupons", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const { code, discountType, discountValue, discountPercent, minOrderValue, maxUses, active } = req.body;

      if (!code) {
        return res.status(400).json({ error: "Código do cupom é obrigatório" });
      }

      const existingCoupon = await storage.getCouponByCode(code.toUpperCase());
      if (existingCoupon) {
        return res.status(400).json({ error: "Este código de cupom já existe" });
      }

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        discountType: discountType || "percent",
        discountValue: discountValue || "0",
        discountPercent: discountPercent || 0,
        minOrderValue: minOrderValue || null,
        maxUses: maxUses || null,
        resellerId: vendorId,
        active: active ?? true,
      });

      res.json(coupon);
    } catch (error) {
      console.error("[Vendor Coupons POST] Error:", error);
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });

  app.put("/api/vendor/coupons/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const couponId = parseInt(req.params.id);
      const coupon = await storage.getCoupon(couponId);

      if (!coupon || coupon.resellerId !== vendorId) {
        return res.status(404).json({ error: "Cupom não encontrado" });
      }

      const { code, discountType, discountValue, discountPercent, minOrderValue, maxUses, active } = req.body;

      if (code && code.toUpperCase() !== coupon.code) {
        const existingCoupon = await storage.getCouponByCode(code.toUpperCase());
        if (existingCoupon) {
          return res.status(400).json({ error: "Este código de cupom já existe" });
        }
      }

      const updated = await storage.updateCoupon(couponId, {
        code: code?.toUpperCase() || coupon.code,
        discountType: discountType || coupon.discountType,
        discountValue: discountValue ?? coupon.discountValue,
        discountPercent: discountPercent ?? coupon.discountPercent,
        minOrderValue: minOrderValue,
        maxUses: maxUses,
        active: active ?? coupon.active,
      });

      res.json(updated);
    } catch (error) {
      console.error("[Vendor Coupons PUT] Error:", error);
      res.status(500).json({ error: "Failed to update coupon" });
    }
  });

  app.delete("/api/vendor/coupons/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const vendorId = tokenToVendor.get(token!);
      const couponId = parseInt(req.params.id);
      const coupon = await storage.getCoupon(couponId);

      if (!coupon || coupon.resellerId !== vendorId) {
        return res.status(404).json({ error: "Cupom não encontrado" });
      }

      await storage.deleteCoupon(couponId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Vendor Coupons DELETE] Error:", error);
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  // Get orders by email for customer redemption page
  app.get("/api/orders/by-email", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const allOrders = await storage.getOrders();
      const customerOrders = allOrders.filter(o => o.email.toLowerCase() === email.toLowerCase());

      const ordersWithItems = await Promise.all(
        customerOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return {
            ...order,
            items: items.map(item => ({
              ...item,
              secretContent: item.deliveredContent || null,
            })),
          };
        })
      );

      res.json(ordersWithItems);
    } catch (error) {
      console.error("[Orders by Email] Error:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get unviewed paid orders count for a specific email (for notification badge)
  app.get("/api/orders/unviewed-count", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const allOrders = await storage.getOrders();
      const unviewedCount = allOrders.filter(
        o => o.email.toLowerCase() === email.toLowerCase() && 
             o.status === "paid" && 
             !o.viewedByBuyer
      ).length;

      res.json({ count: unviewedCount });
    } catch (error) {
      console.error("[Unviewed Orders Count] Error:", error);
      res.status(500).json({ error: "Failed to get unviewed count" });
    }
  });

  // Mark orders as viewed by buyer
  app.post("/api/orders/mark-viewed", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const allOrders = await storage.getOrders();
      const ordersToMark = allOrders.filter(
        o => o.email.toLowerCase() === email.toLowerCase() && 
             o.status === "paid" && 
             !o.viewedByBuyer
      );

      for (const order of ordersToMark) {
        await storage.updateOrder(order.id, { viewedByBuyer: true });
      }

      res.json({ success: true, markedCount: ordersToMark.length });
    } catch (error) {
      console.error("[Mark Orders Viewed] Error:", error);
      res.status(500).json({ error: "Failed to mark orders as viewed" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { email, whatsapp, customerName, customerCpf, items, couponCode, discountAmount, totalAmount } = req.body;

      console.log("[POST /api/orders] Received order request:", { email, whatsapp, customerName, customerCpf: customerCpf ? "PROVIDED" : "NOT PROVIDED", itemCount: items?.length });

      if (!email || !whatsapp || !items || items.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get resellerId from first item and validate stock
      const firstProduct = await storage.getProduct(items[0].productId);
      const resellerId = firstProduct?.resellerId || null;

      // Validate stock availability for all items
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product || !product.stock || !product.stock.trim()) {
          return res.status(400).json({ 
            error: `Produto "${item.productName}" está esgotado. Não é possível criar o pedido.` 
          });
        }
      }

      try {
        const order = await storage.createOrder({
          email,
          whatsapp: whatsapp || null,
          customerName: customerName || null,
          customerCpf: customerCpf || null,
          status: "pending",
          paymentMethod: "pix_manual",
          totalAmount,
          couponCode: couponCode || null,
          discountAmount: discountAmount || null,
          pixCode: null,
          resellerId: resellerId,
          pixQrCode: null,
          pagseguroOrderId: null,
          deliveredContent: null,
        });

        console.log("[POST /api/orders] Order created successfully:", order.id);

        for (const item of items) {
          console.log(`[POST /api/orders] Creating item: productId=${item.productId}, variantId=${item.variantId || 'none'}, quantity=1 (FORCED)`);
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            quantity: 1, // FORCED: Digital products are always qty=1
            variantId: item.variantId || null,
            variantName: item.variantName || null,
          });
        }

        console.log("[POST /api/orders] Order items created");

        res.json({
          id: order.id,
          status: "pending",
        });
      } catch (dbError: any) {
        console.error("[POST /api/orders] Database error details:", {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          stack: dbError.stack,
        });
        throw dbError;
      }
    } catch (error: any) {
      console.error("[POST /api/orders] Order creation error:", error);
      res.status(500).json({ 
        error: "Failed to create order",
        details: error.message || "Unknown error"
      });
    }
  });

  app.get("/api/orders/:id/status", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.status === "paid") {
        return res.json({
          status: order.status,
          deliveredContent: order.deliveredContent,
        });
      }

      const settings = readSettings();
      const pagseguroToken = settings?.pagseguroToken;
      const baseUrl = "https://api.pagseguro.com";
      
      if (pagseguroToken && order.pagseguroOrderId) {
        try {
          const statusResponse = await fetch(
            `${baseUrl}/orders/${order.pagseguroOrderId}`,
            {
              headers: {
                "Authorization": `Bearer ${pagseguroToken}`,
                "x-api-version": "4.0",
              },
            }
          );

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            const charge = statusData.charges?.[0];
            
            if (charge?.status === "PAID") {
              const orderItems = await storage.getOrderItems(orderId);
              let deliveredContent = "";

              for (const item of orderItems) {
                const product = await storage.getProduct(item.productId);
                let itemDeliveredContent = "";
                if (product && product.stock) {
                  const stockLines = product.stock.split("\n").filter(line => line.trim());
                  
                  for (let i = 0; i < item.quantity && i < stockLines.length; i++) {
                    deliveredContent += stockLines[i] + "\n";
                    itemDeliveredContent += stockLines[i] + "\n";
                  }

                  const remainingStock = stockLines.slice(item.quantity).join("\n");
                  await storage.updateProduct(item.productId, { stock: remainingStock });
                  
                  // Update item with delivered content
                  if (itemDeliveredContent.trim()) {
                    await storage.updateOrderItem(item.id, { deliveredContent: itemDeliveredContent.trim() });
                  }
                }
              }

              await storage.updateOrder(orderId, {
                status: "paid",
                deliveredContent: deliveredContent.trim(),
              });

              // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
              try {
                if (order.resellerId) {
                  const reseller = await storage.getReseller(order.resellerId);
                  if (reseller) {
                    const valorVenda = parseFloat(order.totalAmount as string || "0");
                    const currentBalance = parseFloat(reseller.walletBalance as string || "0");
                    
                    // Calcular taxa de 10% para produtos premium
                    let taxaPremium = 0;
                    for (const item of orderItems) {
                      const product = await storage.getProduct(item.productId);
                      if (product && product.isPremium) {
                        const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                        taxaPremium += itemValue * 0.10; // 10% de taxa
                      }
                    }
                    
                    // Valor líquido = valor da venda - taxa premium
                    const valorLiquido = valorVenda - taxaPremium;
                    const newBalance = currentBalance + valorLiquido;

                    await storage.updateReseller(order.resellerId, {
                      walletBalance: newBalance.toFixed(2),
                      totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
                      totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
                    });
                    
                    if (taxaPremium > 0) {
                      console.log(`[GET /api/orders/:id/status] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
                    }
                    console.log(`[GET /api/orders/:id/status] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
                  }
                }
              } catch (walletError: any) {
                console.error("[GET /api/orders/:id/status] Erro ao atualizar saldo:", walletError.message);
              }

              return res.json({
                status: "paid",
                deliveredContent: deliveredContent.trim(),
              });
            }
          }
        } catch (pagseguroError) {
          console.error("PagSeguro status check error:", pagseguroError);
        }
      }

      res.json({ status: order.status });
    } catch (error) {
      res.status(500).json({ error: "Failed to check order status" });
    }
  });

  app.get("/api/pedidos/:id/status", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ 
        status: order.status,
        deliveredContent: order.status === "paid" ? order.deliveredContent : null 
      });
    } catch (error) {
      console.error("[GET /api/pedidos/:id/status] Error:", error);
      res.status(500).json({ error: "Failed to check order status" });
    }
  });

  // Resend delivery email for paid orders
  app.post("/api/orders/:id/resend-email", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { email } = req.body;
      
      if (isNaN(orderId)) {
        return res.status(400).json({ error: "ID do pedido invalido" });
      }
      
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: "Pedido nao encontrado" });
      }

      // Verify the email matches the order email for security
      if (order.email.toLowerCase() !== email?.toLowerCase()) {
        return res.status(403).json({ error: "Email nao corresponde ao pedido" });
      }

      if (order.status !== "paid") {
        return res.status(400).json({ error: "Pedido ainda nao foi pago" });
      }

      if (!order.deliveredContent) {
        return res.status(400).json({ error: "Nenhum conteudo para entregar" });
      }

      // Get order items for product names
      const orderItems = await storage.getOrderItems(orderId);
      const productNames = orderItems.map(item => item.productName).join(", ");

      // Get store name from reseller or settings
      let storeName = "GOLDNET";
      if (order.resellerId) {
        const reseller = await storage.getReseller(order.resellerId);
        if (reseller?.storeName) {
          storeName = reseller.storeName;
        }
      } else {
        const settings = await storage.getSettings();
        if (settings?.storeName) {
          storeName = settings.storeName;
        }
      }

      // Send the delivery email
      const emailResult = await sendDeliveryEmail({
        to: order.email,
        orderId,
        productName: productNames,
        deliveredContent: order.deliveredContent,
        customerName: order.customerName || undefined,
        storeName,
      });

      if (!emailResult.success) {
        console.error(`[Resend Email] Failed to resend email for order ${orderId}:`, emailResult.error);
        return res.status(500).json({ 
          error: "Falha ao reenviar e-mail", 
          details: emailResult.error 
        });
      }

      console.log(`[Resend Email] Successfully resent delivery email for order ${orderId} to ${order.email}`);
      
      res.json({ 
        success: true, 
        message: "E-mail reenviado com sucesso" 
      });
    } catch (error: any) {
      console.error("[Resend Email] Error:", error);
      res.status(500).json({ error: "Falha ao reenviar e-mail de entrega" });
    }
  });

  app.post("/api/orders/:id/simulate-payment", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const orderItems = await storage.getOrderItems(orderId);
      let deliveredContent = "";

      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (product && product.stock) {
          const stockLines = product.stock.split("\n").filter(line => line.trim());
          
          for (let i = 0; i < item.quantity && i < stockLines.length; i++) {
            deliveredContent += stockLines[i] + "\n";
          }

          const remainingStock = stockLines.slice(item.quantity).join("\n");
          await storage.updateProduct(item.productId, { stock: remainingStock });
        }
      }

      await storage.updateOrder(orderId, {
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });

      // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
      try {
        if (order.resellerId) {
          const reseller = await storage.getReseller(order.resellerId);
          if (reseller) {
            const valorVenda = parseFloat(order.totalAmount as string || "0");
            const currentBalance = parseFloat(reseller.walletBalance as string || "0");
            
            // Calcular taxa de 10% para produtos premium
            let taxaPremium = 0;
            for (const item of orderItems) {
              const product = await storage.getProduct(item.productId);
              if (product && product.isPremium) {
                const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                taxaPremium += itemValue * 0.10; // 10% de taxa
              }
            }
            
            // Valor líquido = valor da venda - taxa premium
            const valorLiquido = valorVenda - taxaPremium;
            const newBalance = currentBalance + valorLiquido;

            await storage.updateReseller(order.resellerId, {
              walletBalance: newBalance.toFixed(2),
              totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
              totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
            });
            
            if (taxaPremium > 0) {
              console.log(`[Simulate Payment] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
            }
            console.log(`[Simulate Payment] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
          }
        }
      } catch (walletError: any) {
        console.error("[Simulate Payment] Erro ao atualizar saldo:", walletError.message);
      }

      res.json({
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to simulate payment" });
    }
  });

  // PagSeguro PIX Payment - Create PIX payment using PagSeguro API v4
  // Supports both admin config (global) and reseller config (individual accounts)
  // Accepts customerCpf for CPF/CNPJ (pessoa física or jurídica)
  app.post("/api/pay/pagseguro", async (req, res) => {
    try {
      const { orderId, amount, email, description, resellerId, customerCpf, customerName } = req.body;

      if (!orderId || !amount || !email) {
        return res.status(400).json({ error: "Campos obrigatórios: orderId, amount, email" });
      }

      const { createPixPayment } = await import("./pagSeguroController");
      
      let resellerConfig: { 
        resellerPagseguroToken?: string; 
        resellerPagseguroEmail?: string; 
      } = {};
      
      if (resellerId) {
        const reseller = await storage.getReseller(parseInt(resellerId));
        if (reseller?.pagseguroToken) {
          resellerConfig = {
            resellerPagseguroToken: reseller.pagseguroToken,
            resellerPagseguroEmail: reseller.pagseguroEmail || undefined,
          };
          console.log(`[PagSeguro] Using reseller ${resellerId} credentials for payment (PRODUCAO)`);
        }
      }
      
      const result = await createPixPayment({
        orderId: parseInt(orderId),
        amount: parseFloat(amount),
        email,
        description,
        customerCpf,
        customerName,
        ...resellerConfig,
      });

      // Update order with PagSeguro data
      await storage.updateOrder(parseInt(orderId), {
        pagseguroOrderId: result.pagseguroOrderId,
        pixCode: result.pixCode,
        pixQrCode: result.qrCodeBase64,
        paymentMethod: "pix_pagseguro",
      });

      console.log(`[PagSeguro] Payment created for order ${orderId}:`, result.pagseguroOrderId);

      res.json({
        success: true,
        pagseguroOrderId: result.pagseguroOrderId,
        pixCode: result.pixCode,
        qrCodeBase64: result.qrCodeBase64,
        qrCodeImageUrl: result.qrCodeImageUrl,
        status: result.status,
      });
    } catch (error: any) {
      console.error("[PagSeguro Route] Error:", error.message);
      res.status(500).json({ error: error.message || "Falha ao criar pagamento PIX" });
    }
  });

  // PagSeguro OAuth Connect - Start OAuth flow to connect seller account
  app.get("/api/pagseguro/connect/:resellerId", async (req, res) => {
    try {
      const resellerId = parseInt(req.params.resellerId);
      const token = req.headers.authorization?.replace("Bearer ", "");
      
      if (!isVendorAuthenticated(token)) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      
      const vendorId = tokenToVendor.get(token!);
      if (vendorId !== resellerId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { getConnectUrl } = await import("./pagSeguroOAuth");
      
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      const redirectUri = `${protocol}://${host}/api/pagseguro/callback`;
      
      const connectUrl = await getConnectUrl(resellerId, redirectUri);
      
      if (!connectUrl) {
        return res.status(400).json({ 
          error: "PagSeguro não configurado. O administrador precisa configurar o Client ID da aplicação."
        });
      }
      
      res.json({ connectUrl });
    } catch (error: any) {
      console.error("[PagSeguro OAuth] Connect error:", error.message);
      res.status(500).json({ error: "Erro ao iniciar conexão com PagSeguro" });
    }
  });

  // PagSeguro OAuth Callback - Handle authorization callback
  app.get("/api/pagseguro/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError } = req.query;
      
      if (oauthError) {
        console.error("[PagSeguro OAuth] Authorization denied:", oauthError);
        return res.redirect("/vendor?pagseguro=error&message=authorization_denied");
      }
      
      if (!code || !state) {
        return res.redirect("/vendor?pagseguro=error&message=missing_params");
      }
      
      let stateData: { resellerId: number };
      try {
        stateData = JSON.parse(Buffer.from(state as string, "base64").toString());
      } catch (e) {
        return res.redirect("/vendor?pagseguro=error&message=invalid_state");
      }
      
      const { exchangeCodeForToken, saveOAuthTokens } = await import("./pagSeguroOAuth");
      
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      const redirectUri = `${protocol}://${host}/api/pagseguro/callback`;
      
      const tokens = await exchangeCodeForToken(code as string, redirectUri);
      
      if (!tokens) {
        return res.redirect("/vendor?pagseguro=error&message=token_exchange_failed");
      }
      
      const saved = await saveOAuthTokens(stateData.resellerId, tokens);
      
      if (!saved) {
        return res.redirect("/vendor?pagseguro=error&message=save_failed");
      }
      
      console.log(`[PagSeguro OAuth] Successfully connected reseller ${stateData.resellerId}`);
      res.redirect("/vendor?pagseguro=success");
    } catch (error: any) {
      console.error("[PagSeguro OAuth] Callback error:", error.message);
      res.redirect("/vendor?pagseguro=error&message=unknown_error");
    }
  });

  // PagSeguro OAuth Disconnect - Disconnect seller account
  app.post("/api/pagseguro/disconnect/:resellerId", async (req, res) => {
    try {
      const resellerId = parseInt(req.params.resellerId);
      const token = req.headers.authorization?.replace("Bearer ", "");
      
      if (!isVendorAuthenticated(token)) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      
      const vendorId = tokenToVendor.get(token!);
      if (vendorId !== resellerId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      const { disconnectPagSeguro } = await import("./pagSeguroOAuth");
      
      const success = await disconnectPagSeguro(resellerId);
      
      if (success) {
        res.json({ success: true, message: "PagSeguro desconectado com sucesso" });
      } else {
        res.status(500).json({ error: "Erro ao desconectar PagSeguro" });
      }
    } catch (error: any) {
      console.error("[PagSeguro OAuth] Disconnect error:", error.message);
      res.status(500).json({ error: "Erro ao desconectar PagSeguro" });
    }
  });

  // PagSeguro OAuth Status - Check connection status
  app.get("/api/pagseguro/status/:resellerId", async (req, res) => {
    try {
      const resellerId = parseInt(req.params.resellerId);
      
      const reseller = await storage.getReseller(resellerId);
      
      if (!reseller) {
        return res.status(404).json({ error: "Revendedor não encontrado" });
      }
      
      res.json({
        connected: reseller.pagseguroConnected || false,
        accountId: reseller.pagseguroAccountId || null,
        hasManualToken: !!reseller.pagseguroToken,
      });
    } catch (error: any) {
      console.error("[PagSeguro OAuth] Status error:", error.message);
      res.status(500).json({ error: "Erro ao verificar status" });
    }
  });

  // ============== ABACATEPAY INTEGRATION (NEW) ==============

  // Endpoint principal para criar cobrança PIX via AbacatePay
  // POST /api/pagamento/criar
  app.post("/api/pagamento/criar", async (req, res) => {
    try {
      const { valor, id_produto, id_revendedor, email, customerName, customerCpf, whatsapp, orderId: existingOrderId } = req.body;

      console.log("[AbacatePay] /api/pagamento/criar - Request:", { valor, id_produto, id_revendedor, email, existingOrderId });

      if (!valor || !id_produto) {
        return res.status(400).json({ error: "Campos obrigatórios: valor, id_produto" });
      }

      // Buscar produto
      const product = await storage.getProduct(parseInt(id_produto));
      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      // Validar estoque
      if (!product.stock || !product.stock.trim()) {
        return res.status(400).json({ error: "Produto sem estoque disponível" });
      }

      // Determinar revendedor (do produto ou do request)
      const resellerId = id_revendedor ? parseInt(id_revendedor) : product.resellerId;
      let reseller = null;
      let commissionPercent = 10; // Padrão: 10% para plataforma

      if (resellerId) {
        reseller = await storage.getReseller(resellerId);
        if (reseller) {
          commissionPercent = reseller.commissionPercent || 10;
        }
      }

      // Calcular split (comissão plataforma e valor revendedor)
      const valorTotal = parseFloat(valor);
      const comissaoPlataforma = (valorTotal * commissionPercent) / 100;
      const valorRevendedor = valorTotal - comissaoPlataforma;

      console.log(`[AbacatePay] Split calculado: Total=${valorTotal}, Plataforma=${comissaoPlataforma} (${commissionPercent}%), Revendedor=${valorRevendedor}`);

      let order: any;

      // Se já existe um orderId, usar esse pedido ao invés de criar novo
      if (existingOrderId) {
        console.log(`[AbacatePay] Usando pedido existente: ${existingOrderId}`);
        const existingOrder = await storage.getOrder(existingOrderId);
        if (!existingOrder) {
          return res.status(404).json({ error: "Pedido não encontrado" });
        }
        
        // Atualizar pedido existente com dados do AbacatePay
        await storage.updateOrder(existingOrderId, {
          paymentMethod: "pix_abacatepay",
          comissaoPlataforma: comissaoPlataforma.toFixed(2),
          valorRevendedor: valorRevendedor.toFixed(2),
        });
        
        order = { ...existingOrder, id: existingOrderId };
        console.log(`[AbacatePay] Pedido ${order.id} atualizado para AbacatePay`);
      } else {
        // Criar novo pedido apenas se não existir
        order = await storage.createOrder({
          email: email || "cliente@exemplo.com",
          whatsapp: whatsapp || null,
          customerName: customerName || null,
          customerCpf: customerCpf || null,
          status: "pending",
          paymentMethod: "pix_abacatepay",
          totalAmount: valorTotal.toFixed(2),
          comissaoPlataforma: comissaoPlataforma.toFixed(2),
          valorRevendedor: valorRevendedor.toFixed(2),
          resellerId: resellerId || null,
          pixCode: null,
          pixQrCode: null,
          pagseguroOrderId: null,
          abacatepayBillingId: null,
          deliveredContent: null,
          couponCode: null,
          discountAmount: null,
        });

        // Criar item do pedido apenas para novos pedidos
        await storage.createOrderItem({
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          price: valorTotal.toFixed(2),
          quantity: 1,
        });

        console.log(`[AbacatePay] Pedido ${order.id} criado com split`);
      }

      // Criar cobrança PIX via AbacatePay
      const { createPixPayment } = await import("./abacatePayController");
      
      const result = await createPixPayment({
        orderId: order.id,
        amount: valorTotal,
        email: email || "cliente@exemplo.com",
        description: `Pedido #${order.id} - ${product.name}`,
        customerName: customerName || "Cliente",
      });

      // Atualizar pedido com dados do AbacatePay
      await storage.updateOrder(order.id, {
        abacatepayBillingId: result.billingId,
        pixCode: result.pixCode,
        pixQrCode: result.pixQrCodeUrl || result.checkoutUrl,
      });

      console.log(`[AbacatePay] Payment created for order ${order.id}:`, result.billingId);

      res.json({
        success: true,
        orderId: order.id,
        billingId: result.billingId,
        url: result.checkoutUrl,
        pixCopyPaste: result.pixCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        status: result.status,
        split: {
          valorTotal,
          comissaoPlataforma,
          valorRevendedor,
          comissaoPercent: commissionPercent,
        },
      });
    } catch (error: any) {
      console.error("[AbacatePay] /api/pagamento/criar Error:", error.message);
      res.status(500).json({ error: error.message || "Falha ao criar pagamento PIX" });
    }
  });

  // Abacate Pay PIX Payment (legacy endpoint) - Create PIX payment using Abacate Pay API
  app.post("/api/pay/abacatepay", async (req, res) => {
    try {
      const { orderId, amount, email, description, customerName, resellerId } = req.body;

      if (!orderId || !amount || !email) {
        return res.status(400).json({ error: "Campos obrigatórios: orderId, amount, email" });
      }

      const { createPixPayment } = await import("./abacatePayController");
      
      // AbacatePay deprecated - using PagSeguro instead
      let resellerToken: string | undefined;
      
      const result = await createPixPayment({
        orderId: parseInt(orderId),
        amount: parseFloat(amount),
        email,
        description,
        customerName,
        resellerToken,
      });

      // Update order with Abacate Pay data
      await storage.updateOrder(parseInt(orderId), {
        abacatepayBillingId: result.billingId,
        pixCode: result.pixCode,
        pixQrCode: result.pixQrCodeUrl || result.checkoutUrl,
        paymentMethod: "pix_abacatepay",
      });

      console.log(`[AbacatePay] Payment created for order ${orderId}:`, result.billingId);

      res.json({
        success: true,
        billingId: result.billingId,
        pixCode: result.pixCode,
        pixQrCodeUrl: result.pixQrCodeUrl,
        checkoutUrl: result.checkoutUrl,
        status: result.status,
      });
    } catch (error: any) {
      console.error("[AbacatePay Route] Error:", error.message);
      res.status(500).json({ error: error.message || "Falha ao criar pagamento PIX" });
    }
  });

  // ============== ABACATEPAY WEBHOOK - VERSÃO ROBUSTA ==============
  // PRIORIDADE MÁXIMA: Atualizar status do pedido para PAGO
  // POST /api/webhook/abacatepay
  app.post("/api/webhook/abacatepay", async (req, res) => {
    // ========== PASSO 1: LOG DO PAYLOAD (SEMPRE) ==========
    console.log("==========================================");
    console.log("PAYLOAD:", JSON.stringify(req.body));
    console.log("==========================================");

    try {
      const payload = req.body;
      const event = payload.event || payload.eventType || "";

      // Verificar se é evento de pagamento confirmado
      const isPaid = event === "billing.paid" || 
                     event === "BILLING.PAID" ||
                     event === "payment.confirmed" ||
                     event === "PAYMENT.CONFIRMED";

      console.log("[Webhook] Evento:", event, "| isPaid:", isPaid);

      if (!isPaid) {
        console.log("[Webhook] Evento ignorado (nao e pagamento confirmado)");
        return res.status(200).send("Webhook processado");
      }

      // ========== PASSO 2: LOCALIZAR PEDIDO ==========
      // MÉTODO PRIMÁRIO: Buscar pelo billing_id (event.data.id)
      let order = null;
      let orderId: number | null = null;
      let metodoEncontrado = "";

      // Extrair billing_id do payload (pode estar em diferentes locais)
      const billingId = payload.data?.id || 
                        payload.data?.billing?.id || 
                        payload.data?.pixQrCode?.id ||
                        payload.billingId ||
                        payload.id;

      console.log("[Webhook] billing_id extraido:", billingId);

      if (billingId) {
        // Buscar pedido onde abacatepayBillingId == billing_id
        const allOrders = await storage.getOrders();
        const matchedOrder = allOrders.find((o: any) => o.abacatepayBillingId === billingId);
        
        if (matchedOrder) {
          order = matchedOrder;
          orderId = matchedOrder.id;
          metodoEncontrado = "billing_id";
          console.log("[Webhook] ✓ Pedido encontrado por billing_id! OrderId:", orderId);
        } else {
          console.log("[Webhook] Nenhum pedido com billing_id:", billingId);
        }
      }

      // MÉTODO SECUNDÁRIO: Buscar pelo order_id nos metadados
      if (!order) {
        const metadataOrderId = payload.data?.metadata?.order_id ||
                                payload.data?.metadata?.orderId ||
                                payload.data?.billing?.metadata?.order_id ||
                                payload.data?.billing?.metadata?.orderId ||
                                payload.metadata?.order_id ||
                                payload.metadata?.orderId;

        console.log("[Webhook] metadata.order_id extraido:", metadataOrderId);

        if (metadataOrderId) {
          orderId = parseInt(metadataOrderId);
          order = await storage.getOrder(orderId);
          if (order) {
            metodoEncontrado = "metadata.order_id";
            console.log("[Webhook] ✓ Pedido encontrado por metadata.order_id! OrderId:", orderId);
          }
        }
      }

      // MÉTODO TERCIÁRIO: Buscar pelo externalId do produto (formato: "order-123")
      if (!order) {
        const externalId = payload.data?.billing?.products?.[0]?.externalId ||
                           payload.data?.products?.[0]?.externalId;
        
        console.log("[Webhook] externalId extraido:", externalId);

        if (externalId && externalId.startsWith("order-")) {
          orderId = parseInt(externalId.replace("order-", ""));
          order = await storage.getOrder(orderId);
          if (order) {
            metodoEncontrado = "externalId";
            console.log("[Webhook] ✓ Pedido encontrado por externalId! OrderId:", orderId);
          }
        }
      }

      // Se não encontrou o pedido, retornar 200 mesmo assim (AbacatePay não deve reenviar)
      if (!order || !orderId) {
        console.error("[Webhook] ❌ PEDIDO NAO ENCONTRADO - billing_id:", billingId);
        console.error("[Webhook] Payload completo:", JSON.stringify(payload, null, 2));
        return res.status(200).send("Webhook processado");
      }

      console.log("[Webhook] Pedido localizado:", {
        id: order.id,
        status_atual: order.status,
        metodo: metodoEncontrado
      });

      // Verificar se já foi processado
      if (order.status === "paid" || order.status === "approved") {
        console.log("[Webhook] Pedido ja pago, ignorando duplicata");
        return res.status(200).send("Webhook processado");
      }

      // ========== PASSO 3: ATUALIZAR STATUS IMEDIATAMENTE ==========
      console.log("[Webhook] >>> ATUALIZANDO STATUS PARA 'paid' <<<");
      
      await storage.updateOrder(orderId, {
        status: "paid",
      });

      // Verificar se salvou
      const orderAtualizado = await storage.getOrder(orderId);
      console.log("[Webhook] ✓ STATUS ATUALIZADO! Novo status:", orderAtualizado?.status);

      if (orderAtualizado?.status !== "paid") {
        console.error("[Webhook] ❌ FALHA CRITICA: Status nao foi atualizado!");
      }

      // ========== PASSO 4: PROCESSAR ENTREGA (DEPOIS do status salvo) ==========
      let deliveredContent = "";
      
      try {
        const orderItems = await storage.getOrderItems(orderId);
        
        for (const item of orderItems) {
          const product = await storage.getProduct(item.productId);
          const quantity = item.quantity || 1;

          if (product && product.stock) {
            const stockLines = product.stock.split("\n").filter((line: string) => line.trim());

            if (stockLines.length >= quantity) {
              for (let i = 0; i < quantity; i++) {
                deliveredContent += stockLines[i] + "\n";
              }
              const remainingStock = stockLines.slice(quantity).join("\n");
              await storage.updateProduct(item.productId, { stock: remainingStock });
              console.log("[Webhook] Entregue:", quantity, "item(s) de", product.name);
            } else {
              console.warn("[Webhook] Estoque insuficiente para", product.name);
            }
          }
        }

        // Atualizar pedido com conteudo entregue
        if (deliveredContent.trim()) {
          const settings = readSettings();
          const storeName = settings?.storeName || "GOLDNET";
          const whatsappMessage = `Ola! Pagamento confirmado. Pedido #${orderId}:\n\n${deliveredContent.trim()}`;
          const whatsappLink = order.whatsapp 
            ? generateWhatsAppLink(order.whatsapp, whatsappMessage)
            : null;

          await storage.updateOrder(orderId, {
            deliveredContent: deliveredContent.trim(),
            whatsappDeliveryLink: whatsappLink,
          });
          console.log("[Webhook] Conteudo entregue salvo no pedido");
        }
      } catch (deliveryError: any) {
        console.error("[Webhook] Erro na entrega (status ja salvo):", deliveryError.message);
      }

      // ========== PASSO 5: ATUALIZAR SALDO DO REVENDEDOR ==========
      try {
        if (order.resellerId) {
          const reseller = await storage.getReseller(order.resellerId);
          if (reseller) {
            const valorVenda = parseFloat(order.totalAmount as string || "0");
            const currentBalance = parseFloat(reseller.walletBalance as string || "0");
            
            // Calcular taxa de 10% para produtos premium
            const orderItemsForFee = await storage.getOrderItems(orderId);
            let taxaPremium = 0;
            
            for (const item of orderItemsForFee) {
              const product = await storage.getProduct(item.productId);
              if (product && product.isPremium) {
                const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                taxaPremium += itemValue * 0.10; // 10% de taxa
              }
            }
            
            // Valor líquido = valor da venda - taxa premium
            const valorLiquido = valorVenda - taxaPremium;
            const newBalance = currentBalance + valorLiquido;

            await storage.updateReseller(order.resellerId, {
              walletBalance: newBalance.toFixed(2),
              totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
              totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
            });
            
            if (taxaPremium > 0) {
              console.log(`[Webhook] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
            }
            console.log("[Webhook] Saldo revendedor atualizado:", newBalance.toFixed(2));
          }
        }
      } catch (walletError: any) {
        console.error("[Webhook] Erro ao atualizar saldo (status ja salvo):", walletError.message);
      }

      // ========== PASSO 6: ENVIAR EMAIL (try/catch isolado) ==========
      try {
        if (order.email && deliveredContent.trim()) {
          const orderItems = await storage.getOrderItems(orderId);
          const productNames = orderItems.map((item: any) => item.productName || "Produto Digital").join(", ");
          const settings = readSettings();
          const storeName = settings?.storeName || "GOLDNET";

          console.log("[Webhook] Enviando email para:", order.email);
          
          const emailResult = await sendDeliveryEmail({
            to: order.email,
            orderId,
            productName: productNames,
            deliveredContent: deliveredContent.trim(),
            storeName,
          });
          
          if (emailResult.success) {
            console.log("[Webhook] ✓ Email enviado com sucesso");
          } else {
            console.error("[Webhook] Erro no email (ignorado):", emailResult.error);
          }
        }
      } catch (emailError: any) {
        console.error("[Webhook] Erro de email (ignorado):", emailError.message);
      }

      console.log("==========================================");
      console.log("PEDIDO", orderId, "PROCESSADO COM SUCESSO!");
      console.log("==========================================");

      // ========== RESPOSTA FINAL ==========
      return res.status(200).send("Webhook processado");

    } catch (error: any) {
      console.error("[Webhook] ERRO CRITICO:", error.message);
      console.error("[Webhook] Stack:", error.stack);
      // Mesmo com erro, retornar 200 para o AbacatePay não reenviar
      return res.status(200).send("Webhook processado");
    }
  });

  // Abacate Pay Webhook (legacy endpoint) - Receives payment confirmations and auto-delivers products
  // Note: Raw body is captured via rawBody property attached by middleware in index.ts
  app.post("/api/webhooks/abacatepay", async (req, res) => {
    try {
      const signature = req.headers["x-webhook-signature"] as string || 
                        req.headers["x-abacatepay-signature"] as string || "";
      
      // Use raw body if available (attached by middleware), fallback to stringified body
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      
      console.log("[AbacatePay Webhook Legacy] Received event:", req.body.event);
      console.log("[AbacatePay Webhook Legacy] Signature present:", !!signature);
      console.log("[AbacatePay Webhook Legacy] Raw body available:", !!(req as any).rawBody);
      
      // Verify signature - in dev mode (no ABACATEPAY_WEBHOOK_SECRET), skip verification
      const { verifyAbacateSignature } = await import("./abacatePayController");
      const isValid = verifyAbacateSignature(rawBody, signature);
      if (!isValid) {
        console.error("[AbacatePay Webhook Legacy] Invalid signature - rejecting request");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const { parseWebhookPayload } = await import("./abacatePayController");
      const webhookData = parseWebhookPayload(req.body);
      
      console.log("[AbacatePay Webhook Legacy] Parsed data:", webhookData);

      // Process payment confirmation
      if (webhookData.isPaid && webhookData.orderId) {
        const orderId = parseInt(webhookData.orderId);
        const order = await storage.getOrder(orderId);
        
        if (order && order.status === "pending") {
          console.log(`[AbacatePay Webhook Legacy] Processing auto-delivery for order ${orderId}`);
          
          const orderItems = await storage.getOrderItems(orderId);
          
          // FIRST PASS: Validate ALL items have sufficient stock before delivering anything
          for (const item of orderItems) {
            const product = await storage.getProduct(item.productId);
            const quantity = item.quantity || 1;
            
            if (!product || !product.stock) {
              console.error(`[AbacatePay Webhook Legacy] ❌ Product ${item.productId} has no stock field`);
              return res.status(400).json({ 
                error: `Insufficient stock for product ${item.productName}`,
                orderId,
                productId: item.productId
              });
            }
            
            const stockLines = product.stock.split("\n").filter(line => line.trim());
            if (stockLines.length < quantity) {
              console.error(`[AbacatePay Webhook Legacy] ❌ Insufficient stock for ${product.name} (have ${stockLines.length}, need ${quantity})`);
              return res.status(400).json({ 
                error: `Insufficient stock for ${product.name}: have ${stockLines.length}, need ${quantity}`,
                orderId,
                productId: item.productId
              });
            }
          }
          
          // SECOND PASS: Deliver products (all validated above)
          let deliveredContent = "";
          for (const item of orderItems) {
            const product = await storage.getProduct(item.productId);
            const quantity = item.quantity || 1;
            console.log(`[AbacatePay Webhook Legacy] Delivering item: ${product?.name} (qty: ${quantity})`);
            
            if (product && product.stock) {
              const stockLines = product.stock.split("\n").filter(line => line.trim());
              
              // FIFO: Take quantity items from stock
              for (let i = 0; i < quantity; i++) {
                deliveredContent += stockLines[i] + "\n";
                console.log(`[AbacatePay Webhook Legacy] ✓ Delivered: ${stockLines[i]}`);
              }

              // Remove delivered lines from stock and update
              const remainingStock = stockLines.slice(quantity).join("\n");
              await storage.updateProduct(item.productId, { stock: remainingStock });
              console.log(`[AbacatePay Webhook Legacy] ✓ Stock updated. Remaining lines: ${stockLines.length - quantity}`);
            }
          }

          // Generate WhatsApp delivery link
          const settings = readSettings();
          const storeName = settings?.storeName || "GOLDNET";
          const whatsappMessage = `Ola! Seu pagamento foi confirmado. Aqui esta sua entrega do pedido #${orderId} na ${storeName}:\n\n${deliveredContent.trim()}\n\nObrigado pela compra!`;
          const whatsappLink = order.whatsapp 
            ? generateWhatsAppLink(order.whatsapp, whatsappMessage)
            : null;

          // Mark order as paid and save delivered content + WhatsApp link
          await storage.updateOrder(orderId, {
            status: "paid",
            deliveredContent: deliveredContent.trim(),
            whatsappDeliveryLink: whatsappLink,
          });

          // Update reseller wallet balance (SPLIT)
          if (order.resellerId && order.valorRevendedor) {
            const reseller = await storage.getReseller(order.resellerId);
            if (reseller) {
              const valorRevendedor = parseFloat(order.valorRevendedor as string);
              const currentBalance = parseFloat(reseller.walletBalance as string || "0");
              const newBalance = currentBalance + valorRevendedor;

              await storage.updateReseller(order.resellerId, {
                walletBalance: newBalance.toFixed(2),
                totalSales: (parseFloat(reseller.totalSales as string || "0") + parseFloat(order.totalAmount as string)).toFixed(2),
                totalCommission: (parseFloat(reseller.totalCommission as string || "0") + valorRevendedor).toFixed(2),
              });

              console.log(`[AbacatePay Webhook Legacy] ✅ Reseller ${order.resellerId} balance updated: +R$${valorRevendedor.toFixed(2)}`);
            }
          }

          // Send delivery email automatically
          if (order.email) {
            const productNames = orderItems.map((item: any) => item.productName || "Produto Digital").join(", ");
            sendDeliveryEmail({
              to: order.email,
              orderId,
              productName: productNames,
              deliveredContent: deliveredContent.trim(),
              storeName,
            }).then(result => {
              if (result.success) {
                console.log(`[AbacatePay Webhook Legacy] ✓ Email sent to ${order.email}`);
              } else {
                console.error(`[AbacatePay Webhook Legacy] ❌ Email failed: ${result.error}`);
              }
            });
          }

          console.log(`[AbacatePay Webhook Legacy] ✅ Order ${orderId} auto-approved and delivered`);
          if (whatsappLink) {
            console.log(`[AbacatePay Webhook Legacy] 📱 WhatsApp link generated: ${whatsappLink}`);
          }
        } else if (order) {
          console.log(`[AbacatePay Webhook Legacy] Order ${orderId} already processed (status: ${order.status})`);
        } else {
          console.log(`[AbacatePay Webhook Legacy] Order ${orderId} not found`);
        }
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[AbacatePay Webhook Legacy] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Abacate Pay - Check payment status manually
  app.get("/api/pay/abacatepay/status/:billingId", async (req, res) => {
    try {
      const { billingId } = req.params;
      
      // AbacatePay deprecated - using PagSeguro instead
      let resellerToken: string | undefined;
      
      const { checkPaymentStatus } = await import("./abacatePayController");
      const status = await checkPaymentStatus(billingId, resellerToken);
      
      res.json(status);
    } catch (error: any) {
      console.error("[AbacatePay Status] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== PAGSEGURO CONNECT ROUTES ==============

  // PagSeguro Connect - Generate authorization URL for reseller
  app.get("/api/pagseguro/connect/authorize", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const vendorId = tokenToVendor.get(token!);
    if (!vendorId) {
      return res.status(401).json({ error: "Vendedor não encontrado" });
    }
    
    try {
      const baseUrl = process.env.APP_URL 
        || (process.env.REPLIT_DOMAINS?.split(',')[0] 
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
            : 'http://localhost:5000');
      
      const redirectUri = `${baseUrl}/api/pagseguro/connect/callback`;
      const state = `${vendorId}-${crypto.randomBytes(16).toString("hex")}`;
      
      const authUrl = generateAuthorizationUrl(redirectUri, state);
      
      console.log(`[PagSeguro Connect] Generated auth URL for vendor ${vendorId}`);
      res.json({ authUrl, state });
    } catch (error: any) {
      console.error("[PagSeguro Connect] Error generating auth URL:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // PagSeguro Connect - OAuth callback
  app.get("/api/pagseguro/connect/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    
    if (oauthError) {
      console.error("[PagSeguro Connect] OAuth error:", oauthError);
      return res.redirect(`/vendor/settings?pagseguro_error=${encodeURIComponent(String(oauthError))}`);
    }
    
    if (!code || !state) {
      return res.redirect("/vendor/settings?pagseguro_error=missing_params");
    }
    
    // Extract vendorId from state
    const stateParts = String(state).split("-");
    const vendorId = parseInt(stateParts[0]);
    
    if (isNaN(vendorId)) {
      return res.redirect("/vendor/settings?pagseguro_error=invalid_state");
    }
    
    try {
      const baseUrl = process.env.APP_URL 
        || (process.env.REPLIT_DOMAINS?.split(',')[0] 
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` 
            : 'http://localhost:5000');
      
      const redirectUri = `${baseUrl}/api/pagseguro/connect/callback`;
      
      const tokens = await exchangeCodeForToken(String(code), redirectUri);
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiresIn);
      
      // Update reseller with PagSeguro credentials
      await storage.updateReseller(vendorId, {
        pagseguroAccessToken: tokens.accessToken,
        pagseguroRefreshToken: tokens.refreshToken,
        pagseguroTokenExpiresAt: expiresAt,
        pagseguroAccountId: tokens.accountId || null,
        pagseguroConnected: true,
      });
      
      console.log(`[PagSeguro Connect] Vendor ${vendorId} connected successfully`);
      res.redirect("/vendor/settings?pagseguro_success=true");
    } catch (error: any) {
      console.error("[PagSeguro Connect] Callback error:", error.message);
      res.redirect(`/vendor/settings?pagseguro_error=${encodeURIComponent(error.message)}`);
    }
  });

  // PagSeguro Connect - Disconnect account
  app.post("/api/pagseguro/connect/disconnect", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const vendorId = tokenToVendor.get(token!);
    if (!vendorId) {
      return res.status(401).json({ error: "Vendedor não encontrado" });
    }
    
    try {
      await storage.updateReseller(vendorId, {
        pagseguroAccessToken: null,
        pagseguroRefreshToken: null,
        pagseguroTokenExpiresAt: null,
        pagseguroAccountId: null,
        pagseguroConnected: false,
      });
      
      console.log(`[PagSeguro Connect] Vendor ${vendorId} disconnected`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[PagSeguro Connect] Disconnect error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // PagSeguro Connect - Check connection status
  app.get("/api/pagseguro/connect/status", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const vendorId = tokenToVendor.get(token!);
    if (!vendorId) {
      return res.status(401).json({ error: "Vendedor não encontrado" });
    }
    
    try {
      const reseller = await storage.getReseller(vendorId);
      
      res.json({
        connected: reseller?.pagseguroConnected || false,
        accountId: reseller?.pagseguroAccountId || null,
        expiresAt: reseller?.pagseguroTokenExpiresAt || null,
      });
    } catch (error: any) {
      console.error("[PagSeguro Connect] Status check error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // PagSeguro Connect - Check payment status
  app.get("/api/pay/pagseguro/status/:pagseguroOrderId", async (req, res) => {
    try {
      const { pagseguroOrderId } = req.params;
      
      // Look up order to get reseller credentials
      const orders = await storage.getOrders();
      const order = orders.find(o => o.pagseguroOrderId === pagseguroOrderId);
      
      if (!order?.resellerId) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      
      const reseller = await storage.getReseller(order.resellerId);
      
      if (!reseller?.pagseguroAccessToken) {
        return res.status(400).json({ error: "Credenciais PagSeguro não encontradas" });
      }
      
      const status = await checkOrderStatus(
        pagseguroOrderId,
        reseller.pagseguroAccessToken
      );
      
      res.json(status);
    } catch (error: any) {
      console.error("[PagSeguro Connect] Status check error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // PagSeguro Connect - Webhook for payment notifications
  app.post("/api/pay/pagseguro/webhook", async (req, res) => {
    try {
      console.log("[PagSeguro Webhook] Received:", JSON.stringify(req.body, null, 2));
      
      const payload = req.body;
      const { orderId, isPaid, pagseguroOrderId } = parsePagseguroWebhook(payload);
      
      if (!orderId) {
        console.log("[PagSeguro Webhook] No orderId found in payload");
        return res.status(200).json({ received: true });
      }
      
      const orderIdNum = parseInt(orderId);
      const order = await storage.getOrder(orderIdNum);
      
      if (!order) {
        console.log(`[PagSeguro Webhook] Order ${orderId} not found`);
        return res.status(200).json({ received: true });
      }
      
      if (isPaid && order.status !== "paid") {
        console.log(`[PagSeguro Webhook] Payment confirmed for order ${orderId}`);
        
        // Auto-approve the order (same logic as AbacatePay)
        const orderItems = await storage.getOrderItems(orderIdNum);
        let deliveredContent = "";
        
        for (const item of orderItems) {
          const product = await storage.getProduct(item.productId);
          
          if (product && product.stock) {
            const stockLines = product.stock.split("\n").filter((line: string) => line.trim());
            
            if (stockLines.length >= 1) {
              deliveredContent += stockLines[0] + "\n";
              const remainingStock = stockLines.slice(1).join("\n");
              await storage.updateProduct(item.productId, { stock: remainingStock });
            }
          }
        }
        
        await storage.updateOrder(orderIdNum, {
          status: "paid",
          deliveredContent: deliveredContent.trim(),
        });
        
        // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
        try {
          if (order.resellerId) {
            const reseller = await storage.getReseller(order.resellerId);
            if (reseller) {
              const valorVenda = parseFloat(order.totalAmount as string || "0");
              const currentBalance = parseFloat(reseller.walletBalance as string || "0");
              
              // Calcular taxa de 10% para produtos premium
              let taxaPremium = 0;
              for (const item of orderItems) {
                const product = await storage.getProduct(item.productId);
                if (product && product.isPremium) {
                  const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                  taxaPremium += itemValue * 0.10; // 10% de taxa
                }
              }
              
              // Valor líquido = valor da venda - taxa premium
              const valorLiquido = valorVenda - taxaPremium;
              const newBalance = currentBalance + valorLiquido;

              await storage.updateReseller(order.resellerId, {
                walletBalance: newBalance.toFixed(2),
                totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
                totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
              });
              
              if (taxaPremium > 0) {
                console.log(`[PagSeguro Webhook] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
              }
              console.log(`[PagSeguro Webhook] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
            }
          }
        } catch (walletError: any) {
          console.error("[PagSeguro Webhook] Erro ao atualizar saldo:", walletError.message);
        }
        
        // Send delivery email
        if (order.email) {
          const productNames = orderItems.map((item: any) => item.productName || "Produto").join(", ");
          const settings = readSettings();
          
          sendDeliveryEmail({
            to: order.email,
            orderId: orderIdNum,
            productName: productNames,
            deliveredContent: deliveredContent.trim(),
            storeName: settings?.storeName || "Nossa Loja",
          }).then(result => {
            if (result.success) {
              console.log(`[PagSeguro Webhook] Email sent to ${order.email}`);
            } else {
              console.error(`[PagSeguro Webhook] Email failed: ${result.error}`);
            }
          });
        }
        
        console.log(`[PagSeguro Webhook] Order ${orderId} auto-approved`);
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[PagSeguro Webhook] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== END PAGSEGURO CONNECT ROUTES ==============

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // Return the deterministic token based on credentials
      console.log("[Admin Login] ✅ Credentials valid - Returning deterministic token");
      res.json({ success: true, token: VALID_ADMIN_TOKEN });
    } else {
      console.log("[Admin Login] ❌ Invalid credentials attempt");
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  app.get("/api/admin/products", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // CORREÇÃO CRÍTICA: Controller createProduct blindado
  app.post("/api/admin/products", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      console.log("[POST /api/admin/products] Full request body:", JSON.stringify(req.body, null, 2));
      
      // CORREÇÃO: Se imagem falhar ou vier vazia, usa imagem padrão
      const receivedImageUrl = req.body.imageUrl;
      const hasValidImage = receivedImageUrl && typeof receivedImageUrl === 'string' && receivedImageUrl.trim() !== "";
      const imagePath = hasValidImage ? receivedImageUrl.trim() : DEFAULT_PRODUCT_IMAGE;
      
      console.log("[POST /api/admin/products] ImageUrl recebida:", receivedImageUrl);
      if (!hasValidImage) {
        console.warn("[POST /api/admin/products] ⚠️ IMAGEM PADRÃO USADA - imageUrl estava vazia ou inválida");
      }
      console.log("[POST /api/admin/products] ImageUrl final:", imagePath);
      
      // Validação básica dos campos obrigatórios
      if (!req.body.name || req.body.name.trim() === "") {
        console.error("[POST /api/admin/products] ERRO: Nome do produto é obrigatório");
        return res.status(400).json({ error: "Nome do produto é obrigatório" });
      }
      
      // CORREÇÃO: Produtos SEMPRE nascem ATIVOS para aparecer na loja imediatamente
      console.log("[POST /api/admin/products] Forçando active=true para visibilidade imediata");
      
      // Extract only the fields that exist in the database
      const productData = {
        name: req.body.name.trim(),
        description: req.body.description || null,
        imageUrl: imagePath, // Usa imagem padrão se vazio
        originalPrice: req.body.originalPrice || "0.00",
        currentPrice: req.body.currentPrice || "0.00",
        stock: req.body.stock || "",
        category: req.body.category || "Outros",
        subcategory: req.body.subcategory || null,
        active: true, // SEMPRE ativo - produto nasce pronto para venda
      };
      
      console.log("[POST /api/admin/products] Creating with data:", JSON.stringify(productData, null, 2));
      const product = await storage.createProduct(productData);
      console.log("[POST /api/admin/products] ✅ Produto criado com sucesso:", product.id, product.name);
      res.json(product);
    } catch (error) {
      const errorObj = error as any;
      // CORREÇÃO 3: Logs detalhados de erro
      console.error("[POST /api/admin/products] ERRO CRÍTICO ao criar produto:", {
        message: errorObj.message,
        code: errorObj.code,
        detail: errorObj.detail,
        column: errorObj.column,
        table: errorObj.table,
        constraint: errorObj.constraint,
        stack: errorObj.stack,
        fullError: errorObj.toString(),
      });
      res.status(500).json({ error: "Falha ao criar produto: " + errorObj.message });
    }
  });

  // CORREÇÃO: Controller updateProduct blindado
  app.put("/api/admin/products/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const id = parseInt(req.params.id);
      
      // CORREÇÃO: Se imagem falhar ou vier vazia, usa imagem padrão
      const receivedImageUrl = req.body.imageUrl;
      const hasValidImage = receivedImageUrl && typeof receivedImageUrl === 'string' && receivedImageUrl.trim() !== "";
      const imagePath = hasValidImage ? receivedImageUrl.trim() : DEFAULT_PRODUCT_IMAGE;
      
      console.log("[PUT /api/admin/products/:id] ImageUrl recebida:", receivedImageUrl);
      if (!hasValidImage) {
        console.warn("[PUT /api/admin/products/:id] ⚠️ IMAGEM PADRÃO USADA - imageUrl estava vazia ou inválida");
      }
      console.log("[PUT /api/admin/products/:id] ImageUrl final:", imagePath);
      
      const updateData = {
        name: req.body.name?.trim() || undefined,
        description: req.body.description || null,
        imageUrl: imagePath, // Usa imagem padrão se vazio
        originalPrice: req.body.originalPrice,
        currentPrice: req.body.currentPrice,
        stock: req.body.stock || "",
        category: req.body.category || "Outros",
        subcategory: req.body.subcategory || null,
        active: req.body.active,
      };
      console.log("[PUT /api/admin/products/:id] Updating product", id, "with:", JSON.stringify(updateData, null, 2));
      const product = await storage.updateProduct(id, updateData);
      console.log("[PUT /api/admin/products/:id] ✅ Produto atualizado com sucesso:", product?.id, product?.name);
      res.json(product);
    } catch (error) {
      const errorObj = error as any;
      console.error("[PUT /api/admin/products/:id] ERRO CRÍTICO ao atualizar produto:", {
        message: errorObj.message,
        code: errorObj.code,
        detail: errorObj.detail,
        stack: errorObj.stack,
      });
      res.status(500).json({ error: "Falha ao atualizar produto: " + errorObj.message });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.get("/api/admin/orders", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/admin/coupons", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const coupons = await storage.getCoupons();
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch coupons" });
    }
  });

  app.post("/api/admin/coupons", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const coupon = await storage.createCoupon({
        code: req.body.code.toUpperCase(),
        discountPercent: req.body.discountPercent,
        active: req.body.active ?? true,
      });
      res.json(coupon);
    } catch (error) {
      res.status(500).json({ error: "Failed to create coupon" });
    }
  });

  app.delete("/api/admin/coupons/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const id = parseInt(req.params.id);
      await storage.deleteCoupon(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  app.get("/api/admin/settings", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const settings = readSettings();
      res.json(settings);
    } catch (error) {
      console.error("Admin settings fetch error:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const settingsData = {
        storeName: req.body.storeName,
        logoUrl: req.body.logoUrl || null,
        themeColor: req.body.themeColor,
        textColor: req.body.textColor,
        pixKey: req.body.pixKey || null,
        pagseguroToken: req.body.pagseguroToken || null,
        pagseguroEmail: req.body.pagseguroEmail || null,
        pagseguroSandbox: false,
        pagseguroApiUrl: "https://api.pagseguro.com",
        supportEmail: req.body.supportEmail || null,
        whatsappContact: req.body.whatsappContact || null,
      };

      // Save to database
      const dbSettings = await storage.updateSettings(settingsData);

      // Also save to settings.json file for consistency
      const currentSettings = readSettings();
      const updatedFileSettings = {
        ...currentSettings,
        ...settingsData,
      };
      writeSettings(updatedFileSettings);

      console.log("[PUT /api/admin/settings] Settings saved to both database and file");
      res.json(dbSettings);
    } catch (error) {
      console.error("[PUT /api/admin/settings] Error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Vendor Login Route
  app.post("/api/vendor/login", async (req, res) => {
    const { email, password } = req.body;

    try {
      if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
      }

      const vendor = await storage.getResellerByEmail(email);
      
      if (!vendor) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      if (vendor.password !== password) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      if (!vendor.active) {
        return res.status(403).json({ error: "Sua loja foi bloqueada" });
      }

      const token = generateToken();
      
      // Clear any existing tokens for this vendor from in-memory caches
      const existingToken = vendorTokens.get(vendor.id);
      if (existingToken) {
        tokenToVendor.delete(existingToken);
        vendorSessionCache.delete(existingToken);
      }
      
      // Persist session to database (30 days expiry)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      try {
        await storage.createVendorSession(token, vendor.id, expiresAt);
        console.log("[Vendor Login] Session persisted to database for vendor:", vendor.id);
      } catch (sessionError: any) {
        console.error("[Vendor Login] Failed to persist session, using in-memory:", sessionError.message);
      }
      
      // Also store in memory for immediate access
      vendorTokens.set(vendor.id, token);
      tokenToVendor.set(token, vendor.id);
      vendorSessionCache.set(token, { resellerId: vendor.id, expiresAt: expiresAt.getTime() });

      console.log("[🔴 Vendor Login] ✅ Sucesso - retornando dados do vendor");
      console.log("[🔴 Vendor Login] Subscription:", {
        status: vendor.subscriptionStatus,
        expiresAt: vendor.subscriptionExpiresAt,
      });

      res.json({
        success: true,
        redirect: "/vendor/dashboard",
        token,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          slug: vendor.slug,
          storeName: vendor.storeName,
          subscriptionStatus: vendor.subscriptionStatus,
          subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        },
      });
    } catch (error: any) {
      console.error("[Vendor Login] Error:", error?.message || error);
      const errorMsg = error?.message?.includes("column") ? "Erro no servidor - tente novamente em alguns segundos" : "Falha ao fazer login";
      res.status(500).json({ error: errorMsg });
    }
  });

  // Token validation/restoration endpoint
  // Allows frontend to restore session after server restart
  app.post("/api/vendor/restore-session", async (req, res) => {
    const { vendorId, email } = req.body;
    const existingToken = req.headers.authorization?.replace("Bearer ", "");

    console.log("[Vendor Restore Session] Attempting to restore session for vendor:", vendorId || email);

    try {
      // Check if token is already valid in memory
      if (existingToken && tokenToVendor.has(existingToken)) {
        const storedVendorId = tokenToVendor.get(existingToken);
        const vendor = await storage.getReseller(storedVendorId!);
        if (vendor && vendor.active) {
          console.log("[Vendor Restore Session] Token already valid in memory for vendor:", vendor.id);
          return res.json({
            success: true,
            token: existingToken,
            vendor: {
              id: vendor.id,
              name: vendor.name,
              email: vendor.email,
              slug: vendor.slug,
              storeName: vendor.storeName,
              subscriptionStatus: vendor.subscriptionStatus,
              subscriptionExpiresAt: vendor.subscriptionExpiresAt,
            },
          });
        }
      }
      
      // Check if token exists in database (persistent session after restart)
      if (existingToken) {
        const dbSession = await storage.getVendorSession(existingToken);
        if (dbSession) {
          const vendor = await storage.getReseller(dbSession.resellerId);
          if (vendor && vendor.active) {
            // Restore token to in-memory cache
            vendorTokens.set(vendor.id, existingToken);
            tokenToVendor.set(existingToken, vendor.id);
            vendorSessionCache.set(existingToken, { 
              resellerId: vendor.id, 
              expiresAt: dbSession.expiresAt.getTime() 
            });
            
            console.log("[Vendor Restore Session] Token restored from database for vendor:", vendor.id);
            return res.json({
              success: true,
              token: existingToken,
              vendor: {
                id: vendor.id,
                name: vendor.name,
                email: vendor.email,
                slug: vendor.slug,
                storeName: vendor.storeName,
                subscriptionStatus: vendor.subscriptionStatus,
                subscriptionExpiresAt: vendor.subscriptionExpiresAt,
              },
            });
          }
        }
      }

      // Token is invalid, try to restore by vendorId or email
      let vendor = null;
      if (vendorId) {
        vendor = await storage.getReseller(vendorId);
      } else if (email) {
        vendor = await storage.getResellerByEmail(email);
      }

      if (!vendor) {
        console.log("[Vendor Restore Session] Vendor not found");
        return res.status(401).json({ error: "Sessão expirada. Faça login novamente.", requireLogin: true });
      }

      if (!vendor.active) {
        console.log("[Vendor Restore Session] Vendor is inactive");
        return res.status(403).json({ error: "Sua loja foi bloqueada", requireLogin: true });
      }

      // Generate new token and establish session
      const newToken = generateToken();
      
      // Clear any existing tokens for this vendor from in-memory caches
      const oldToken = vendorTokens.get(vendor.id);
      if (oldToken) {
        tokenToVendor.delete(oldToken);
        vendorSessionCache.delete(oldToken);
      }
      
      // Persist session to database (30 days expiry)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      try {
        await storage.createVendorSession(newToken, vendor.id, expiresAt);
        console.log("[Vendor Restore Session] Session persisted to database for vendor:", vendor.id);
      } catch (sessionError: any) {
        console.error("[Vendor Restore Session] Failed to persist session:", sessionError.message);
      }
      
      // Store in memory
      vendorTokens.set(vendor.id, newToken);
      tokenToVendor.set(newToken, vendor.id);
      vendorSessionCache.set(newToken, { resellerId: vendor.id, expiresAt: expiresAt.getTime() });

      console.log("[Vendor Restore Session] Session restored successfully for vendor:", vendor.id);

      res.json({
        success: true,
        token: newToken,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          slug: vendor.slug,
          storeName: vendor.storeName,
          subscriptionStatus: vendor.subscriptionStatus,
          subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        },
      });
    } catch (error: any) {
      console.error("[Vendor Restore Session] Error:", error?.message || error);
      res.status(500).json({ error: "Erro ao restaurar sessão", requireLogin: true });
    }
  });

  // Vendor/Reseller Routes
  app.post("/api/vendor/register", async (req, res) => {
    console.log("[Vendor Register] Request received:", { name: req.body.name, email: req.body.email });
    
    try {
      const { name, email, password, slug, storeName } = req.body;
      
      if (!name || !email || !password || !slug) {
        console.log("[Vendor Register] Missing fields:", { name: !!name, email: !!email, password: !!password, slug: !!slug });
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log("[Vendor Register] Checking for existing email:", email);
      const existing = await storage.getResellerByEmail(email);
      
      if (existing) {
        console.log("[Vendor Register] Email already exists:", email);
        return res.status(409).json({ error: "Email já cadastrado" });
      }

      console.log("[Vendor Register] Creating new vendor:", { name, email, slug });
      
      // Calculate 7-day trial expiration date
      const trialExpiresAt = new Date();
      trialExpiresAt.setDate(trialExpiresAt.getDate() + 7);
      
      const vendor = await storage.createReseller({
        name,
        email,
        password,
        slug,
        storeName: storeName || name,
        pixKey: "",
        paymentClientId: "",
        paymentClientSecret: "",
        subscriptionStatus: "trial",
        subscriptionExpiresAt: trialExpiresAt,
        active: true,
      });

      console.log("[Vendor Register] Vendor created successfully:", { id: vendor.id, slug: vendor.slug });
      const token = generateToken();
      vendorTokens.set(vendor.id, token);
      tokenToVendor.set(token, vendor.id);

      res.json({
        success: true,
        token,
        vendor: {
          id: vendor.id,
          name: vendor.name,
          email: vendor.email,
          slug: vendor.slug,
          storeName: vendor.storeName,
          commissionPercent: vendor.commissionPercent,
          totalSales: vendor.totalSales,
          totalCommission: vendor.totalCommission,
          subscriptionStatus: vendor.subscriptionStatus,
          subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        },
        message: "Loja criada com 7 dias grátis de trial!",
      });
    } catch (error: any) {
      console.error("[Vendor Register] Error:", error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        return res.status(409).json({ error: "Email já cadastrado" });
      }
      if (error.code === '42703') {
        return res.status(500).json({ error: "Database schema error. Please try again later." });
      }
      
      const errorMessage = error?.message || String(error);
      res.status(500).json({ 
        error: "Erro ao criar loja", 
        details: errorMessage.substring(0, 200)
      });
    }
  });

  // Vendor profile by token (no ID required)
  app.get("/api/vendor/profile", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        slug: vendor.slug,
        storeName: vendor.storeName,
        logoUrl: vendor.logoUrl,
        themeColor: vendor.themeColor,
        pixKey: vendor.pixKey || null,
        phone: vendor.phone || null,
        cpf: vendor.cpf || null,
        customDomain: vendor.customDomain || null,
        commissionPercent: vendor.commissionPercent,
        walletBalance: vendor.walletBalance || "0.00",
        totalSales: vendor.totalSales,
        totalCommission: vendor.totalCommission,
        subscriptionStatus: vendor.subscriptionStatus || "inactive",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        pagseguroToken: vendor.pagseguroToken || null,
        pagseguroEmail: vendor.pagseguroEmail || null,
        faviconUrl: vendor.faviconUrl || null,
        ogImageUrl: vendor.ogImageUrl || null,
        storeDescription: vendor.storeDescription || null,
        createdAt: vendor.createdAt,
      });
    } catch (error) {
      console.error("[Vendor Profile GET] Error:", error);
      res.status(500).json({ error: "Failed to fetch vendor profile" });
    }
  });

  app.put("/api/vendor/profile", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { storeName, pixKey, pixKeyType, pixHolderName, pagseguroToken, pagseguroEmail, faviconUrl, ogImageUrl, storeDescription, customDomain } = req.body;

    try {
      const updateData: any = {};
      if (storeName !== undefined) updateData.storeName = storeName;
      if (pixKey !== undefined) updateData.pixKey = pixKey;
      if (pagseguroToken !== undefined) updateData.pagseguroToken = pagseguroToken;
      if (pagseguroEmail !== undefined) updateData.pagseguroEmail = pagseguroEmail;
      if (faviconUrl !== undefined) updateData.faviconUrl = faviconUrl;
      if (ogImageUrl !== undefined) updateData.ogImageUrl = ogImageUrl;
      if (storeDescription !== undefined) updateData.storeDescription = storeDescription;
      if (customDomain !== undefined) {
        const normalizedDomain = customDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
        updateData.customDomain = normalizedDomain || null;
      }
      updateData.pagseguroSandbox = false;

      const vendor = await storage.updateReseller(vendorId, updateData);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        slug: vendor.slug,
        storeName: vendor.storeName,
        pixKey: vendor.pixKey || null,
        pagseguroToken: vendor.pagseguroToken || null,
        pagseguroEmail: vendor.pagseguroEmail || null,
        faviconUrl: vendor.faviconUrl || null,
        ogImageUrl: vendor.ogImageUrl || null,
        storeDescription: vendor.storeDescription || null,
        customDomain: vendor.customDomain || null,
      });
    } catch (error) {
      console.error("[Vendor Profile PUT] Error:", error);
      res.status(500).json({ error: "Failed to update vendor profile" });
    }
  });

  app.get("/api/vendor/profile/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const vendorId = parseInt(req.params.id);
    
    console.log("[Vendor Profile] Request for vendor:", vendorId);

    try {
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        console.log("[Vendor Profile] Vendor not found:", vendorId);
        return res.status(404).json({ error: "Vendor not found" });
      }

      console.log("[Vendor Profile] Vendor found:", vendor.slug);
      
      // Prepare store URL: use custom domain if available, fallback to slug-based URL
      const storeUrl = vendor.customDomain 
        ? `https://${vendor.customDomain}`
        : null; // Frontend will construct using window.location.origin + /loja/ + slug
      
      res.json({
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        slug: vendor.slug,
        storeName: vendor.storeName,
        logoUrl: vendor.logoUrl,
        themeColor: vendor.themeColor,
        pixKey: vendor.pixKey || null,
        phone: vendor.phone || null,
        cpf: vendor.cpf || null,
        customDomain: vendor.customDomain || null,
        storeUrl: storeUrl,
        commissionPercent: vendor.commissionPercent,
        walletBalance: vendor.walletBalance || "0.00",
        totalSales: vendor.totalSales,
        totalCommission: vendor.totalCommission,
        subscriptionStatus: vendor.subscriptionStatus || "inactive",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        pagseguroToken: vendor.pagseguroToken || null,
        pagseguroEmail: vendor.pagseguroEmail || null,
        pagseguroSandbox: false,
        preferredPaymentMethod: vendor.preferredPaymentMethod || "pagseguro",
        verificationStatus: vendor.verificationStatus || null,
        verifiedAt: vendor.verifiedAt || null,
      });
    } catch (error) {
      console.error("[Vendor Profile] Error:", error);
      res.status(500).json({ error: "Failed to fetch vendor profile" });
    }
  });

  // ============== VENDOR DOCUMENT VERIFICATION ENDPOINTS ==============
  
  // PUT /api/vendor/documents - Vendor uploads document images
  app.put("/api/vendor/documents", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const vendorId = tokenToVendor.get(token!);
    if (!vendorId) {
      return res.status(401).json({ error: "Vendor not found" });
    }
    
    try {
      const { documentFrontUrl, documentBackUrl } = req.body;
      
      console.log("[Vendor Documents] Received upload request for vendor:", vendorId);
      console.log("[Vendor Documents] Front URL:", documentFrontUrl ? 'received' : 'missing');
      console.log("[Vendor Documents] Back URL:", documentBackUrl ? 'received' : 'missing');
      
      if (!documentFrontUrl || !documentBackUrl) {
        return res.status(400).json({ error: "Both document front and back images are required" });
      }
      
      // Update vendor with document URLs and set status to pending
      const vendor = await storage.updateReseller(vendorId, {
        documentFrontUrl,
        documentBackUrl,
        verificationStatus: "pending",
        verificationNotes: null,
        verifiedAt: null,
      });
      
      console.log("[Vendor Documents] Documents uploaded successfully for vendor:", vendorId);
      console.log("[Vendor Documents] Updated vendor data:", {
        id: vendor?.id,
        documentFrontUrl: vendor?.documentFrontUrl ? 'set' : 'not set',
        documentBackUrl: vendor?.documentBackUrl ? 'set' : 'not set',
        verificationStatus: vendor?.verificationStatus
      });
      
      res.json({
        success: true,
        verificationStatus: vendor?.verificationStatus,
        message: "Documentos enviados com sucesso. Aguarde a verificacao.",
      });
    } catch (error) {
      console.error("[Vendor Documents] Error:", error);
      res.status(500).json({ error: "Failed to upload documents" });
    }
  });

  // GET /api/vendor/verification-status - Get current verification status
  app.get("/api/vendor/verification-status", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isVendorAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const vendorId = tokenToVendor.get(token!);
    if (!vendorId) {
      return res.status(401).json({ error: "Vendor not found" });
    }
    
    try {
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      
      res.json({
        documentFrontUrl: vendor.documentFrontUrl || null,
        documentBackUrl: vendor.documentBackUrl || null,
        verificationStatus: vendor.verificationStatus || "pending",
        verificationNotes: vendor.verificationNotes || null,
        verifiedAt: vendor.verifiedAt || null,
      });
    } catch (error) {
      console.error("[Vendor Verification Status] Error:", error);
      res.status(500).json({ error: "Failed to fetch verification status" });
    }
  });

  // GET /api/admin/pending-verifications - List vendors pending verification
  app.get("/api/admin/pending-verifications", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const resellers = await storage.getAllResellers();
      
      // Debug: Log all resellers with documents
      const withDocs = resellers.filter((r: any) => r.documentFrontUrl || r.documentBackUrl);
      console.log("[Admin Pending Verifications] Total resellers:", resellers.length);
      console.log("[Admin Pending Verifications] Resellers with any doc:", withDocs.length);
      withDocs.forEach((r: any) => {
        console.log(`  - ID ${r.id} (${r.storeName || r.name}): status="${r.verificationStatus}", front=${r.documentFrontUrl ? 'YES' : 'no'}, back=${r.documentBackUrl ? 'YES' : 'no'}`);
      });
      
      // Filter vendors with documents uploaded - include pending, null, undefined, or empty string status
      // This ensures we catch all vendors who have uploaded documents but may not have status set correctly
      const pendingVerifications = resellers
        .filter((r: any) => {
          const hasDocs = r.documentFrontUrl && r.documentBackUrl;
          const isPending = r.verificationStatus === "pending" || 
                           r.verificationStatus === null || 
                           r.verificationStatus === undefined ||
                           r.verificationStatus === "" ||
                           !r.verificationStatus;
          const isNotApprovedOrRejected = r.verificationStatus !== "approved" && r.verificationStatus !== "rejected";
          
          // Include if has both docs AND is not explicitly approved/rejected
          return hasDocs && isNotApprovedOrRejected;
        })
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          storeName: r.storeName,
          slug: r.slug,
          documentFrontUrl: r.documentFrontUrl,
          documentBackUrl: r.documentBackUrl,
          verificationStatus: r.verificationStatus || "pending",
          createdAt: r.createdAt,
        }));
      
      console.log("[Admin Pending Verifications] Found", pendingVerifications.length, "pending verifications");
      if (pendingVerifications.length > 0) {
        console.log("[Admin Pending Verifications] Returning vendors:", pendingVerifications.map((v: { id: number; storeName: string | null }) => `${v.id} (${v.storeName})`).join(", "));
      }
      res.json(pendingVerifications);
    } catch (error) {
      console.error("[Admin Pending Verifications] Error:", error);
      res.status(500).json({ error: "Failed to fetch pending verifications" });
    }
  });

  // POST /api/admin/verify-vendor/:id - Approve or reject vendor verification
  app.post("/api/admin/verify-vendor/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const vendorId = parseInt(req.params.id);
    if (isNaN(vendorId)) {
      return res.status(400).json({ error: "Invalid vendor ID" });
    }
    
    try {
      const { action, notes } = req.body;
      console.log("[Admin Verify Vendor] Request body:", { action, notes });
      console.log("[Admin Verify Vendor] Vendor ID:", vendorId);
      
      if (action !== "approve" && action !== "reject") {
        return res.status(400).json({ error: "Action must be 'approve' or 'reject'" });
      }
      
      const vendor = await storage.getReseller(vendorId);
      console.log("[Admin Verify Vendor] Found vendor:", vendor ? vendor.id : "NOT FOUND");
      
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }
      
      const updateData = {
        verificationStatus: action === "approve" ? "approved" : "rejected",
        verificationNotes: notes || null,
        verifiedAt: new Date(),
      };
      
      console.log("[Admin Verify Vendor] Update data:", updateData);
      
      const updated = await storage.updateReseller(vendorId, updateData);
      console.log("[Admin Verify Vendor] Update result:", updated ? "success" : "failed");
      
      console.log("[Admin Verify Vendor] Vendor", vendorId, "verification:", action);
      
      res.json({
        success: true,
        vendorId,
        verificationStatus: updateData.verificationStatus,
        message: action === "approve" 
          ? "Vendedor verificado com sucesso" 
          : "Verificacao rejeitada",
      });
    } catch (error: any) {
      console.error("[Admin Verify Vendor] Error:", error);
      console.error("[Admin Verify Vendor] Error message:", error?.message);
      console.error("[Admin Verify Vendor] Error stack:", error?.stack);
      res.status(500).json({ error: "Failed to verify vendor", details: error?.message });
    }
  });

  // POST /api/admin/resellers/:id/toggle-verification - Toggle verification status from admin panel
  app.post("/api/admin/resellers/:id/toggle-verification", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const resellerId = parseInt(req.params.id);
    if (isNaN(resellerId)) {
      return res.status(400).json({ error: "Invalid reseller ID" });
    }
    
    try {
      const { action } = req.body;
      console.log("[Admin Toggle Verification] Request:", { resellerId, action });
      
      if (action !== "approve" && action !== "revoke") {
        return res.status(400).json({ error: "Action must be 'approve' or 'revoke'" });
      }
      
      const reseller = await storage.getReseller(resellerId);
      if (!reseller) {
        return res.status(404).json({ error: "Reseller not found" });
      }
      
      const updateData = {
        verificationStatus: action === "approve" ? "approved" : null,
        verifiedAt: action === "approve" ? new Date() : null,
      };
      
      const updated = await storage.updateReseller(resellerId, updateData);
      console.log("[Admin Toggle Verification] Updated reseller:", resellerId, "to:", updateData.verificationStatus);
      
      res.json({
        success: true,
        resellerId,
        verificationStatus: updateData.verificationStatus,
        message: action === "approve" 
          ? "Revenda verificada com sucesso" 
          : "Verificacao removida",
      });
    } catch (error: any) {
      console.error("[Admin Toggle Verification] Error:", error);
      res.status(500).json({ error: "Failed to toggle verification", details: error?.message });
    }
  });

  // Vendor Products Routes
  app.get("/api/vendor/products", async (req, res) => {
    // CORREÇÃO 2: Pegar vendorId do query OU do token autenticado
    const token = req.headers.authorization?.replace("Bearer ", "");
    let vendorId = parseInt(req.query.vendorId as string);
    
    // Se não veio do query, tenta pegar do token (check async for DB persistence)
    if (!vendorId && token) {
      const vendorAuth = await isVendorAuthenticatedAsync(token);
      if (vendorAuth.valid && vendorAuth.resellerId) {
        vendorId = vendorAuth.resellerId;
        console.log("[Vendor Products GET] ✓ vendorId obtido do token (DB):", vendorId);
      } else if (tokenToVendor.has(token)) {
        vendorId = tokenToVendor.get(token)!;
        console.log("[Vendor Products GET] ✓ vendorId obtido do token (memory):", vendorId);
      }
    }
    
    console.log("[Vendor Products GET] vendorId final:", vendorId, "| query:", req.query.vendorId, "| token:", token ? "presente" : "ausente");
    
    if (!vendorId) {
      console.log("[Vendor Products GET] ⚠️ Missing vendorId - returning ALL products for debugging");
      try {
        const allProducts = await storage.getProducts();
        console.log("[Vendor Products GET] Returning all products:", allProducts.length);
        return res.json(allProducts);
      } catch (error) {
        return res.status(500).json({ error: "Failed to fetch products" });
      }
    }

    try {
      console.log("[Vendor Products GET] Fetching ALL products for vendor:", vendorId, "(sem filtro de status)");
      // CORREÇÃO 2: getResellerProducts retorna TODOS os produtos do revendedor (ativos e inativos)
      const products = await storage.getResellerProducts(vendorId);
      console.log("[Vendor Products GET] ✓ Found", products.length, "products for vendor", vendorId);
      
      // Log detalhado de cada produto
      products.forEach((p: any) => {
        console.log(`[Vendor Products GET] - ID ${p.id}: "${p.name}" | active: ${p.active} | resellerId: ${p.resellerId}`);
      });
      
      // CORREÇÃO: Forçar no-cache para evitar 304 e garantir dados atualizados
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      res.json(products);
    } catch (error) {
      console.error("[Vendor Products] Error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      res.json(cats);
    } catch (error) {
      console.error("[Get Categories] Error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Admin route to delete categories
  app.delete("/api/admin/categories/:id", async (req, res) => {
    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      console.log("[Admin] Deleted category:", categoryId);
      res.json({ success: true, deletedId: categoryId });
    } catch (error) {
      console.error("[Admin Delete Category] Error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Seed fixed categories with subcategories
  app.post("/api/admin/seed-categories", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token || !isAuthenticated(token)) {
        return res.status(401).json({ error: "Nao autorizado" });
      }

      const fixedCategories = [
        {
          name: "Games",
          slug: "games",
          icon: "gamepad",
          displayOrder: 1,
          subcategories: ["Contas", "Itens", "Moedas", "Servicos", "Outros"]
        },
        {
          name: "Steam",
          slug: "steam",
          icon: "steam",
          displayOrder: 2,
          subcategories: ["Chaves (Keys)", "Contas", "Gift Cards", "Jogos", "Saldo"]
        },
        {
          name: "Streaming & TV",
          slug: "streaming-tv",
          icon: "tv",
          displayOrder: 3,
          subcategories: ["Netflix", "Disney+", "Prime Video", "Spotify", "IPTV", "Outros"]
        },
        {
          name: "Cursos & Tutoriais",
          slug: "cursos-tutoriais",
          icon: "book",
          displayOrder: 4,
          subcategories: ["Marketing", "Programacao", "Metodos", "E-books", "Mentoria"]
        },
        {
          name: "Outros",
          slug: "outros",
          icon: "folder",
          displayOrder: 5,
          subcategories: ["Diversos", "Vouchers", "Promocoes"]
        }
      ];

      const results = [];
      for (const cat of fixedCategories) {
        const existing = await storage.getCategoryBySlug(cat.slug);
        if (existing) {
          await storage.updateCategory(existing.id, { 
            subcategories: cat.subcategories,
            displayOrder: cat.displayOrder,
            icon: cat.icon,
            active: true
          });
          results.push({ ...existing, subcategories: cat.subcategories, action: "updated" });
        } else {
          const created = await storage.createCategory({
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            subcategories: cat.subcategories,
            active: true,
            displayOrder: cat.displayOrder,
          });
          results.push({ ...created, action: "created" });
        }
      }

      console.log("[Seed Categories] Seeded categories:", results.map(r => r.name));
      res.json({ success: true, categories: results });
    } catch (error: any) {
      console.error("[Seed Categories] Error:", error);
      res.status(500).json({ error: "Falha ao criar categorias" });
    }
  });

  // Get categories with subcategories for dropdown (public endpoint)
  // Returns the 6 marketplace categories for product creation/filtering
  app.get("/api/categories/with-subcategories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      // Marketplace category slugs that should be shown
      const marketplaceCategorySlugs = [
        "games-mobile",
        "games-pc",
        "steam-plataformas",
        "streaming",
        "cursos",
        "softwares"
      ];
      // Filter only active marketplace categories (no resellerId) and sort by displayOrder
      const globalCats = cats
        .filter((c: any) => !c.resellerId && c.active && marketplaceCategorySlugs.includes(c.slug))
        .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
      res.json(globalCats);
    } catch (error) {
      console.error("[Get Categories With Subcategories] Error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/vendor/products", async (req, res) => {
    try {
      const { name, description, imageUrl, originalPrice, currentPrice, stock, category, subcategory, resellerId: bodyResellerId, deliveryContent, active, slug, categoryId: reqCategoryId, limitPerUser, dynamicMode: rawDynamicMode, isPremium: rawIsPremium } = req.body;
      
      // Coerce dynamicMode to proper boolean (handles string "true"/"false" from JSON)
      const dynamicMode = rawDynamicMode === true || rawDynamicMode === "true";
      const isPremium = rawIsPremium === true || rawIsPremium === "true";

      // CORREÇÃO 1: Obter resellerId do token autenticado OU do body
      const token = req.headers.authorization?.replace("Bearer ", "");
      let finalResellerId: number | undefined = undefined;
      
      // Primeiro tenta pegar do token (usuário logado)
      if (token && tokenToVendor.has(token)) {
        finalResellerId = tokenToVendor.get(token);
        console.log("[Create Product] ✓ resellerId obtido do token autenticado:", finalResellerId);
      }
      
      // Se não veio do token, usa do body
      if (!finalResellerId && bodyResellerId) {
        finalResellerId = bodyResellerId;
        console.log("[Create Product] resellerId obtido do body:", finalResellerId);
      }

      console.log("[Create Product] Request body:", { 
        name, 
        resellerId: finalResellerId,
        bodyResellerId,
        tokenResellerId: token ? tokenToVendor.get(token) : null,
        active,
        slug,
        categoryId: reqCategoryId,
        dynamicMode,
        rawDynamicMode,
        imageUrl: imageUrl ? imageUrl.substring(0, 50) : "EMPTY",
        deliveryContent: deliveryContent ? deliveryContent.substring(0, 50) : "MISSING"
      });

      // Validate required fields - agora usa finalResellerId
      if (!finalResellerId) {
        console.error("[Create Product] ❌ Missing resellerId! Não veio do token nem do body");
        return res.status(400).json({ error: "Missing resellerId - usuário não autenticado" });
      }

      // VERIFICAÇÃO: Bloquear criação de produtos para revendedores não verificados
      const reseller = await storage.getReseller(finalResellerId);
      if (!reseller) {
        console.error("[Create Product] ❌ Reseller not found:", finalResellerId);
        return res.status(404).json({ error: "Revendedor não encontrado" });
      }
      
      if (reseller.verificationStatus !== "approved") {
        console.log("[Create Product] ❌ Reseller not verified:", finalResellerId, "status:", reseller.verificationStatus);
        return res.status(403).json({ 
          error: "Você precisa ter sua conta verificada para adicionar produtos. Envie seus documentos para verificação.",
          code: "NOT_VERIFIED"
        });
      }
      console.log("[Create Product] ✓ Reseller verified:", finalResellerId);

      if (!name || !name.trim()) {
        console.error("[Create Product] Missing product name!");
        return res.status(400).json({ error: "Nome do produto é obrigatório" });
      }

      // Normalize stock/license_keys: handle string or array input
      let normalizedStock = "";
      const stockInput = stock || req.body.license_keys || req.body.licenseKeys || "";
      if (stockInput) {
        if (Array.isArray(stockInput)) {
          normalizedStock = stockInput.filter((line: string) => line && line.trim()).join("\n");
          console.log("[Create Product] Stock/license_keys was array, converted to string");
        } else if (typeof stockInput === "string") {
          normalizedStock = stockInput;
        }
      }

      // Auto-count stock items: count non-empty lines
      const stockItems = normalizedStock 
        ? normalizedStock.split("\n").filter((line: string) => line.trim()).length 
        : 0;

      console.log("[Create Product] Auto-counted stock items:", stockItems, "from stock string");

      // Use provided categoryId or auto-create category
      let categoryId: number | undefined = reqCategoryId || undefined;
      if (!categoryId && category && category.trim()) {
        try {
          let cat = await storage.getCategoryByName(category);
          if (!cat) {
            cat = await storage.createCategory({ name: category, slug: category.toLowerCase().replace(/\s+/g, "-") });
          }
          categoryId = cat.id;
        } catch (catError) {
          console.warn("[Create Product] Category creation failed, continuing without category:", catError);
        }
      }

      // CORREÇÃO: Produtos SEMPRE nascem ATIVOS para aparecer na loja imediatamente
      // Não depende do frontend - força active: true
      const isActive = true;
      console.log("[Create Product] Forçando active=true para visibilidade imediata no marketplace");

      // CORREÇÃO: Handle image URL - usa imagem padrão se vazia ou upload falhou
      let finalImageUrl = DEFAULT_PRODUCT_IMAGE;
      if (imageUrl && imageUrl.trim() && imageUrl.trim() !== "") {
        finalImageUrl = imageUrl.trim();
        console.log("[Create Product] Usando imagem fornecida:", finalImageUrl.substring(0, 50));
      } else {
        console.log("[Create Product] Sem imagem fornecida, usando imagem padrão:", DEFAULT_PRODUCT_IMAGE);
      }

      const product = await storage.createResellerProduct({
        name: name.trim(),
        slug: slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description: description || "",
        imageUrl: finalImageUrl,
        originalPrice: originalPrice || "0",
        currentPrice: currentPrice || "0",
        stock: normalizedStock,
        deliveryContent: deliveryContent || "",
        category: category || "Outros",
        subcategory: subcategory || null,
        categoryId,
        active: isActive,
        limitPerUser: limitPerUser || false,
        dynamicMode: dynamicMode, // CORREÇÃO: Salva o modo dinâmico
        isPremium: isPremium, // CORREÇÃO: Salva se é anúncio premium
        resellerId: finalResellerId, // CORREÇÃO: Usa o resellerId do token ou body
      });

      console.log("[Create Product] Product created successfully:", { id: product.id, resellerId: product.resellerId, stockCount: stockItems, active: isActive });

      res.json(product);
    } catch (error: any) {
      console.error("===========================================");
      console.error("[Create Product] ERRO DETALHADO:", error);
      console.error("[Create Product] Error message:", error.message);
      console.error("[Create Product] Error code:", error.code);
      console.error("[Create Product] Error detail:", error.detail);
      console.error("[Create Product] Error stack:", error.stack);
      console.error("===========================================");
      
      // Provide user-friendly error messages
      let errorMessage = "Erro ao criar produto";
      if (error.code === "23505") {
        errorMessage = "Já existe um produto com esse nome ou slug";
      } else if (error.code === "23503") {
        errorMessage = "Categoria ou revendedor inválido";
      } else if (error.code === "22P02") {
        errorMessage = "Formato de dados inválido - verifique os campos";
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }
      
      res.status(500).json({ error: errorMessage, details: error.message });
    }
  });

  app.patch("/api/vendor/products/:id", async (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, description, imageUrl, currentPrice, originalPrice, stock, category, subcategory, deliveryContent, active, slug, categoryId: reqCategoryId, limitPerUser, dynamicMode: rawDynamicMode, isPremium: rawIsPremium } = req.body;

    // Coerce dynamicMode and isPremium to proper boolean (handles string "true"/"false" from JSON)
    const dynamicMode = rawDynamicMode === true || rawDynamicMode === "true";
    const isPremium = rawIsPremium === true || rawIsPremium === "true";

    console.log("[Update Product] Updating product", productId, "with:", { 
      name, 
      active,
      slug,
      categoryId: reqCategoryId,
      dynamicMode,
      rawDynamicMode,
      deliveryContent: deliveryContent ? deliveryContent.substring(0, 50) : "MISSING" 
    });

    try {
      // Auto-count stock items: count non-empty lines
      const stockItems = stock 
        ? stock.split("\n").filter((line: string) => line.trim()).length 
        : 0;

      console.log("[Update Product] Auto-counted stock items:", stockItems, "from stock string");

      // Use provided categoryId or auto-create category
      let categoryId: number | undefined = reqCategoryId || undefined;
      if (!categoryId && category && category.trim()) {
        let cat = await storage.getCategoryByName(category);
        if (!cat) {
          cat = await storage.createCategory({ name: category, slug: category.toLowerCase().replace(/\s+/g, "-") });
        }
        categoryId = cat.id;
      }

      // Build update object - only include fields that were provided
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (slug !== undefined) updateData.slug = slug;
      if (description !== undefined) updateData.description = description;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (currentPrice !== undefined) updateData.currentPrice = currentPrice;
      if (originalPrice !== undefined) updateData.originalPrice = originalPrice;
      if (stock !== undefined) updateData.stock = stock || "";
      if (deliveryContent !== undefined) updateData.deliveryContent = deliveryContent || "";
      if (category !== undefined) updateData.category = category || "Outros";
      if (subcategory !== undefined) updateData.subcategory = subcategory || null;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (active !== undefined) updateData.active = active;
      if (limitPerUser !== undefined) updateData.limitPerUser = limitPerUser;
      if (rawDynamicMode !== undefined) updateData.dynamicMode = dynamicMode;
      if (rawIsPremium !== undefined) updateData.isPremium = isPremium;

      const product = await storage.updateProduct(productId, updateData);

      console.log("[Update Product] Product updated successfully:", productId, "with stock count:", stockItems);
      res.json(product);
    } catch (error) {
      console.error("[Update Product] Error:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/vendor/products/:id", async (req, res) => {
    const productId = parseInt(req.params.id);

    try {
      // Also delete product variants
      await storage.deleteProductVariants(productId);
      await storage.deleteProduct(productId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Delete Product] Error:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Product Variants Routes
  app.get("/api/products/:productId/variants", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const variants = await storage.getProductVariants(productId);
      console.log("[GET /api/products/:productId/variants] Found", variants.length, "variants for product", productId);
      res.json(variants);
    } catch (error) {
      console.error("[GET /api/products/:productId/variants] Error:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  });

  app.post("/api/products/:productId/variants", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { name, price, stock, active } = req.body;

      if (!name || !price) {
        return res.status(400).json({ error: "Nome e preco sao obrigatorios" });
      }

      const variant = await storage.createProductVariant({
        productId,
        name,
        price: price.toString(),
        stock: stock || "",
        active: active !== false,
      });

      console.log("[POST /api/products/:productId/variants] Created variant:", variant.id, "for product", productId);
      res.json(variant);
    } catch (error) {
      console.error("[POST /api/products/:productId/variants] Error:", error);
      res.status(500).json({ error: "Failed to create variant" });
    }
  });

  app.put("/api/products/:productId/variants/:variantId", async (req, res) => {
    try {
      const variantId = parseInt(req.params.variantId);
      const { name, price, stock, active } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (price !== undefined) updateData.price = price.toString();
      if (stock !== undefined) updateData.stock = stock;
      if (active !== undefined) updateData.active = active;

      const variant = await storage.updateProductVariant(variantId, updateData);
      console.log("[PUT /api/products/:productId/variants/:variantId] Updated variant:", variantId);
      res.json(variant);
    } catch (error) {
      console.error("[PUT /api/products/:productId/variants/:variantId] Error:", error);
      res.status(500).json({ error: "Failed to update variant" });
    }
  });

  app.delete("/api/products/:productId/variants/:variantId", async (req, res) => {
    try {
      const variantId = parseInt(req.params.variantId);
      await storage.deleteProductVariant(variantId);
      console.log("[DELETE /api/products/:productId/variants/:variantId] Deleted variant:", variantId);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/products/:productId/variants/:variantId] Error:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // Bulk update/sync variants for a product
  app.post("/api/products/:productId/variants/sync", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const { variants } = req.body;

      if (!Array.isArray(variants)) {
        return res.status(400).json({ error: "Variants deve ser um array" });
      }

      console.log("[POST /api/products/:productId/variants/sync] Syncing", variants.length, "variants for product", productId);

      // Get existing variants
      const existingVariants = await storage.getProductVariants(productId);
      const existingIds = new Set(existingVariants.map(v => v.id));
      const incomingIds = new Set(variants.filter((v: any) => v.id).map((v: any) => v.id));

      // Delete variants that are no longer present
      for (const existing of existingVariants) {
        if (!incomingIds.has(existing.id)) {
          await storage.deleteProductVariant(existing.id);
          console.log("[Sync] Deleted variant:", existing.id);
        }
      }

      // Update or create variants
      const resultVariants = [];
      for (const v of variants) {
        if (v.id && existingIds.has(v.id)) {
          // Update existing variant
          const updated = await storage.updateProductVariant(v.id, {
            name: v.name,
            price: v.price?.toString() || "0",
            stock: v.stock || "",
            active: v.active !== false,
          });
          if (updated) resultVariants.push(updated);
        } else {
          // Create new variant
          const created = await storage.createProductVariant({
            productId,
            name: v.name,
            price: v.price?.toString() || "0",
            stock: v.stock || "",
            active: v.active !== false,
          });
          resultVariants.push(created);
        }
      }

      console.log("[Sync] Completed. Result:", resultVariants.length, "variants");
      res.json(resultVariants);
    } catch (error) {
      console.error("[POST /api/products/:productId/variants/sync] Error:", error);
      res.status(500).json({ error: "Failed to sync variants" });
    }
  });

  // Vendor Categories Routes
  app.get("/api/vendor/categories", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const categories = await storage.getResellerCategories(vendorId);
      console.log("[GET /api/vendor/categories] Found", categories.length, "categories for vendor", vendorId);
      res.json(categories);
    } catch (error) {
      console.error("[GET /api/vendor/categories] Error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/vendor/categories", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const { name, icon, displayOrder } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Nome da categoria é obrigatório" });
      }

      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      const category = await storage.createCategory({
        name,
        slug,
        resellerId: vendorId,
        icon: icon || "folder",
        displayOrder: displayOrder || 0,
        active: true,
      });

      console.log("[POST /api/vendor/categories] Created category:", category.id, "for vendor", vendorId);
      res.json(category);
    } catch (error) {
      console.error("[POST /api/vendor/categories] Error:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/vendor/categories/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const categoryId = parseInt(req.params.id);
      const { name, icon, displayOrder, active } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) {
        updateData.name = name;
        updateData.slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      }
      if (icon !== undefined) updateData.icon = icon;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      if (active !== undefined) updateData.active = active;

      const category = await storage.updateCategory(categoryId, updateData);
      
      if (!category) {
        return res.status(404).json({ error: "Categoria não encontrada" });
      }

      console.log("[PATCH /api/vendor/categories] Updated category:", categoryId);
      res.json(category);
    } catch (error) {
      console.error("[PATCH /api/vendor/categories] Error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/vendor/categories/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const categoryId = parseInt(req.params.id);
      await storage.deleteCategory(categoryId);
      console.log("[DELETE /api/vendor/categories] Deleted category:", categoryId);
      res.json({ success: true });
    } catch (error) {
      console.error("[DELETE /api/vendor/categories] Error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.post("/api/vendor/categories/reorder", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const { orderedIds } = req.body;
      
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }

      await storage.reorderCategories(vendorId, orderedIds);
      console.log("[POST /api/vendor/categories/reorder] Reordered categories for vendor", vendorId);
      res.json({ success: true });
    } catch (error) {
      console.error("[POST /api/vendor/categories/reorder] Error:", error);
      res.status(500).json({ error: "Failed to reorder categories" });
    }
  });

  // Vendor Settings Routes
  app.patch("/api/vendor/settings/:id", async (req, res) => {
    const vendorId = parseInt(req.params.id);
    const { storeName, logoUrl, themeColor, backgroundColor, buttonColor, cardBorderColor, backgroundImageUrl, buttonRadius, pixKey, phone, cpf, mpAccessToken, supportEmail, whatsappContact, footerDescription, pagseguroToken, pagseguroEmail, pagseguroSandbox, preferredPaymentMethod } = req.body;

    console.log("[Update Settings] Received request for vendor:", vendorId);
    console.log("[Update Settings] Data received:", { storeName, logoUrl, themeColor, backgroundColor, buttonColor, cardBorderColor, backgroundImageUrl, buttonRadius, pixKey, phone, cpf, mpAccessToken: mpAccessToken ? "***" : "", supportEmail, whatsappContact, footerDescription, pagseguroToken: pagseguroToken ? "***" : "", pagseguroEmail, pagseguroSandbox, preferredPaymentMethod });

    try {
      const updateData: any = {};
      if (storeName !== undefined) updateData.storeName = storeName;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
      if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
      if (buttonColor !== undefined) updateData.buttonColor = buttonColor;
      if (cardBorderColor !== undefined) updateData.cardBorderColor = cardBorderColor;
      if (backgroundImageUrl !== undefined) updateData.backgroundImageUrl = backgroundImageUrl;
      if (buttonRadius !== undefined) updateData.buttonRadius = buttonRadius;
      if (pixKey !== undefined) updateData.pixKey = pixKey;
      if (phone !== undefined) updateData.phone = phone;
      if (cpf !== undefined) updateData.cpf = cpf;
      if (mpAccessToken !== undefined) updateData.mpAccessToken = mpAccessToken;
      if (supportEmail !== undefined) updateData.supportEmail = supportEmail;
      if (whatsappContact !== undefined) updateData.whatsappContact = whatsappContact;
      if (footerDescription !== undefined) updateData.footerDescription = footerDescription;
      if (pagseguroToken !== undefined) updateData.pagseguroToken = pagseguroToken;
      if (pagseguroEmail !== undefined) updateData.pagseguroEmail = pagseguroEmail;
      updateData.pagseguroSandbox = false;
      if (preferredPaymentMethod !== undefined) updateData.preferredPaymentMethod = preferredPaymentMethod;

      console.log("[Update Settings] Update data to save:", updateData);

      const vendor = await storage.updateReseller(vendorId, updateData);

      console.log("[Update Settings] Vendor after update:", { id: vendor?.id, logoUrl: vendor?.logoUrl, pixKey: vendor?.pixKey });

      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json(vendor);
    } catch (error) {
      console.error("[Update Settings] Error:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Vendor Appearance Routes
  app.get("/api/vendor/appearance", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({
        logoUrl: vendor.logoUrl || "",
        themeColor: vendor.themeColor || "#8B5CF6",
        backgroundColor: vendor.backgroundColor || "#111827",
        buttonColor: vendor.buttonColor || "#8B5CF6",
        cardBorderColor: vendor.cardBorderColor || "#374151",
        textColor: vendor.textColor || "#FFFFFF",
        cardBackgroundColor: vendor.cardBackgroundColor || "#1A1A2E",
        secondaryColor: vendor.secondaryColor || "#6366F1",
        backgroundImageUrl: vendor.backgroundImageUrl || "",
        buttonRadius: vendor.buttonRadius || 8,
      });
    } catch (error) {
      console.error("[Vendor Appearance GET] Error:", error);
      res.status(500).json({ error: "Failed to get appearance settings" });
    }
  });

  app.patch("/api/vendor/appearance", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { logoUrl, themeColor, backgroundColor, buttonColor, cardBorderColor, textColor, cardBackgroundColor, secondaryColor, backgroundImageUrl, buttonRadius } = req.body;

    try {
      const updateData: any = {};
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
      if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
      if (buttonColor !== undefined) updateData.buttonColor = buttonColor;
      if (cardBorderColor !== undefined) updateData.cardBorderColor = cardBorderColor;
      if (textColor !== undefined) updateData.textColor = textColor;
      if (cardBackgroundColor !== undefined) updateData.cardBackgroundColor = cardBackgroundColor;
      if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor;
      if (backgroundImageUrl !== undefined) updateData.backgroundImageUrl = backgroundImageUrl;
      if (buttonRadius !== undefined) updateData.buttonRadius = buttonRadius;

      const vendor = await storage.updateReseller(vendorId, updateData);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({
        logoUrl: vendor.logoUrl || "",
        themeColor: vendor.themeColor || "#8B5CF6",
        backgroundColor: vendor.backgroundColor || "#111827",
        buttonColor: vendor.buttonColor || "#8B5CF6",
        cardBorderColor: vendor.cardBorderColor || "#374151",
        textColor: vendor.textColor || "#FFFFFF",
        cardBackgroundColor: vendor.cardBackgroundColor || "#1A1A2E",
        secondaryColor: vendor.secondaryColor || "#6366F1",
        backgroundImageUrl: vendor.backgroundImageUrl || "",
        buttonRadius: vendor.buttonRadius || 8,
      });
    } catch (error) {
      console.error("[Vendor Appearance PATCH] Error:", error);
      res.status(500).json({ error: "Failed to update appearance settings" });
    }
  });

  // ==================== WEBHOOKS ====================
  
  // Get vendor webhooks
  app.get("/api/vendor/webhooks", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const webhooksList = await storage.getWebhooks(vendorId);
      res.json(webhooksList);
    } catch (error) {
      console.error("[Vendor Webhooks GET] Error:", error);
      res.status(500).json({ error: "Failed to get webhooks" });
    }
  });

  // Create webhook
  app.post("/api/vendor/webhooks", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { name, url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const { generateWebhookSecret } = await import("./webhookService");
      const secret = generateWebhookSecret();

      const webhook = await storage.createWebhook({
        resellerId: vendorId,
        name: name || "Webhook",
        url,
        secret,
        active: true,
      });

      res.json(webhook);
    } catch (error) {
      console.error("[Vendor Webhooks POST] Error:", error);
      res.status(500).json({ error: "Failed to create webhook" });
    }
  });

  // Delete webhook
  app.delete("/api/vendor/webhooks/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);
    if (!vendorId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const webhookId = parseInt(req.params.id);

    try {
      const webhook = await storage.getWebhook(webhookId);
      if (!webhook || webhook.resellerId !== vendorId) {
        return res.status(404).json({ error: "Webhook not found" });
      }

      await storage.deleteWebhook(webhookId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Vendor Webhooks DELETE] Error:", error);
      res.status(500).json({ error: "Failed to delete webhook" });
    }
  });

  // ==================== END WEBHOOKS ====================

  // Mercado Pago PIX Payment
  app.post("/api/mercadopago/create-pix", async (req, res) => {
    const { resellerId, orderId, totalAmount, email, whatsapp } = req.body;

    if (!resellerId || !totalAmount || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const reseller = await storage.getReseller(resellerId);
      if (!reseller || !reseller.mpAccessToken) {
        return res.status(400).json({ error: "Payment credentials not configured" });
      }

      console.log("[MercadoPago] Creating PIX charge for order:", orderId);
      
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${reseller.mpAccessToken}`,
        },
        body: JSON.stringify({
          transaction_amount: parseFloat(totalAmount),
          description: "Compra de Produtos Digitais",
          payment_method_id: "pix",
          payer: {
            email: email,
            first_name: email.split("@")[0],
          },
          external_reference: `order-${orderId}`,
          notification_url: `${process.env.WEBHOOK_URL || "https://api.example.com"}/webhooks/payment`,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status === "rejected") {
        console.error("[MercadoPago] Payment creation failed:", data);
        return res.status(400).json({ error: data.message || "Failed to create payment" });
      }

      res.json({
        success: true,
        transactionId: data.id,
        pixCode: data.point_of_interaction?.transactionData?.qr_code,
        qrCode: data.point_of_interaction?.transactionData?.qr_code_base64,
        status: data.status,
      });
    } catch (error) {
      console.error("[MercadoPago] Error:", error);
      res.status(500).json({ error: "Failed to create payment transaction" });
    }
  });

  // Check Mercado Pago Payment Status
  app.get("/api/mercadopago/payment-status/:paymentId", async (req, res) => {
    const { paymentId } = req.params;
    const accessToken = req.query.accessToken as string;

    if (!paymentId || !accessToken) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      res.json({
        status: data.status,
        paymentId: data.id,
        approved: data.status === "approved",
      });
    } catch (error) {
      console.error("[MercadoPago] Status check error:", error);
      res.status(500).json({ error: "Failed to check payment status" });
    }
  });

  // Vendor Orders Routes
  app.get("/api/vendor/orders", async (req, res) => {
    const vendorId = parseInt(req.query.vendorId as string);
    console.log("\n🔴🔴🔴 [GET /api/vendor/orders] REQUEST - vendorId:", vendorId);
    
    if (!vendorId) {
      console.log("[GET /api/vendor/orders] ❌ Missing vendorId");
      return res.status(400).json({ error: "Missing vendorId" });
    }

    try {
      const orders = await storage.getResellerOrders(vendorId);
      console.log("🔴 [GET /api/vendor/orders] ✅ Found", orders.length, "orders");
      
      // BRUTAL LOGGING - EVERY ORDER, EVERY ITEM
      orders.forEach((order, orderIdx) => {
        console.log(`\n🔴 Order #${orderIdx}: ID=${order.id}, Items=${order.items?.length || 0}`);
        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any, itemIdx: any) => {
            console.log(`  🔴 Item #${itemIdx}:`);
            console.log(`     - productId: ${item.productId}`);
            console.log(`     - productName (from orderItems table): ${item.productName}`);
            console.log(`     - has product object? ${!!item.product}`);
            if (item.product) {
              console.log(`     - product.name (from products table): ${item.product.name}`);
              console.log(`     - FULL PRODUCT:`, JSON.stringify(item.product, null, 2));
            }
          });
        }
      });
      
      console.log("🔴🔴🔴 SENDING TO CLIENT:", JSON.stringify(orders[0]?.items?.[0]?.product?.name, null, 2));
      res.json(orders);
    } catch (error) {
      console.error("[Vendor Orders] Error:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Vendor Stats/Dashboard Route - CORRECTED LOGIC with BRUTAL LOGGING
  app.get("/api/vendor/stats", async (req, res) => {
    const vendorToken = req.headers.authorization?.replace("Bearer ", "");
    console.log("\n===== [/api/vendor/stats] REQUEST START =====");
    console.log("[Vendor Stats] Token received:", !!vendorToken);
    console.log("[Vendor Stats] Token length:", vendorToken?.length);
    console.log("[Vendor Stats] Token first 20 chars:", vendorToken?.substring(0, 20));
    
    if (!vendorToken) {
      console.error("[Vendor Stats] ❌ NO TOKEN PROVIDED");
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      // Get vendor ID from token (stored in memory)
      let vendorId: number | null = null;
      console.log("[Vendor Stats] Looking for token in vendorTokens map...");
      console.log("[Vendor Stats] Available vendor IDs:", Array.from(vendorTokens.keys()));
      console.log("[Vendor Stats] Total tokens in map:", vendorTokens.size);
      
      // Also check tokenToVendor map
      if (tokenToVendor.has(vendorToken)) {
        vendorId = tokenToVendor.get(vendorToken) || null;
        console.log(`[Vendor Stats] ✅ FOUND TOKEN IN tokenToVendor map! Vendor ID: ${vendorId}`);
      } else {
        console.log("[Vendor Stats] ❌ Token not found in tokenToVendor map");
        console.log("[Vendor Stats] Available tokens in map:", tokenToVendor.size);
        
        const entries = Array.from(vendorTokens.entries());
        for (const [id, token] of entries) {
          console.log(`[Vendor Stats] Checking token for vendor ${id}: ${token === vendorToken ? "✅ MATCH" : "❌ NO MATCH"}`);
          if (token === vendorToken) {
            vendorId = id;
            console.log(`[Vendor Stats] ✅ TOKEN MATCHED FOR VENDOR ${vendorId}`);
            break;
          }
        }
      }

      if (!vendorId) {
        console.error("[Vendor Stats] ❌ Invalid token, cannot find vendorId in map");
        return res.status(401).json({ error: "Invalid token" });
      }

      console.log(`\n[Vendor Stats] ✅ AUTHENTICATED: Vendor ${vendorId}`);
      
      // Get all orders for this vendor
      const allOrders = await storage.getResellerOrders(vendorId);
      console.log(`[Vendor Stats] 📊 Database query returned: ${allOrders.length} orders`);
      
      if (allOrders.length > 0) {
        console.log("[Vendor Stats] Orders details:", allOrders.map(o => ({
          id: o.id,
          status: o.status,
          totalAmount: o.totalAmount,
          resellerId: o.resellerId
        })));
      } else {
        console.log("[Vendor Stats] ⚠️ NO ORDERS FOUND FOR THIS VENDOR!");
      }
      
      // CORRECTED CALCULATIONS:
      // 1. total_revenue: SUM(total_amount) ONLY for orders with status='paid'
      const paidOrders = allOrders.filter(o => o.status === "paid");
      const totalRevenue = paidOrders.reduce((sum, o) => {
        const amount = parseFloat(o.totalAmount.toString()) || 0;
        console.log(`   - Order #${o.id}: status=${o.status}, amount=${amount}`);
        return sum + amount;
      }, 0);

      // 2. orders_count: COUNT ALL orders (paid + pending)
      const totalOrdersCount = allOrders.length;
      const pendingOrdersCount = allOrders.filter(o => o.status === "pending").length;
      const paidOrdersCount = paidOrders.length;

      console.log(`\n[Vendor Stats] 💰 FINAL CALCULATIONS:`, {
        totalRevenue: `R$ ${totalRevenue.toFixed(2)}`,
        totalOrders: totalOrdersCount,
        paidOrders: paidOrdersCount,
        pendingOrders: pendingOrdersCount
      });
      
      console.log("===== [/api/vendor/stats] REQUEST END =====\n");

      res.json({
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders: totalOrdersCount,
        paidOrders: paidOrdersCount,
        pendingOrders: pendingOrdersCount,
      });
    } catch (error) {
      console.error("[Vendor Stats] 🔴 CRITICAL ERROR:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Vendor Approve Order
  app.post("/api/vendor/orders/:id/approve", async (req, res) => {
    const vendorToken = req.headers.authorization?.replace("Bearer ", "");
    
    console.log("[Vendor Approve] Request received for order:", req.params.id);

    try {
      const orderId = parseInt(req.params.id);
      if (!orderId) {
        return res.status(400).json({ error: "ID de pedido inválido" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      console.log("[Vendor Approve] Processing order:", orderId, "Status:", order.status);

      // If already paid, skip approval
      if (order.status === "paid") {
        return res.json({
          success: true,
          status: "paid",
          deliveredContent: order.deliveredContent || "",
          message: "Pedido já foi aprovado",
        });
      }

      const orderItems = await storage.getOrderItems(orderId);
      console.log("[Vendor Approve] Order has", orderItems.length, "items");
      let deliveredContent = "";

      // FIFO Logic: Extract first item from stock list for each product
      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          console.error(`[Vendor Approve] Product not found: ${item.productId}`);
          return res.status(404).json({ error: `Produto ${item.productId} não encontrado` });
        }

        console.log(`[Vendor Approve] Checking stock for product: ${product.name}`);

        if (!product.stock || !product.stock.trim()) {
          console.log(`[Vendor Approve] Product out of stock: ${product.name}`);
          return res.status(400).json({ 
            error: `❌ ERRO: Produto "${product.name}" está ESGOTADO. Não há mais unidades disponíveis no estoque.` 
          });
        }

        // Split stock by newline and filter empty lines
        const stockLines = product.stock.split("\n").filter((line: string) => line.trim());
        
        // For digital products: require only 1 item in stock
        if (stockLines.length < 1) {
          console.log(`[Vendor Approve] Stock check failed: Product has ${stockLines.length} items, need 1`);
          return res.status(400).json({ 
            error: `❌ ERRO: Produto "${product.name}" está ESGOTADO. Não há mais unidades disponíveis no estoque.` 
          });
        }
        
        console.log(`[Vendor Approve] Stock OK: Product has ${stockLines.length} items (need: 1)`);
        
        // FIFO: Take FIRST item from the list
        const deliveredItem = stockLines[0];
        deliveredContent += deliveredItem + "\n";

        console.log(`[Vendor Approve] FIFO - Delivering: "${deliveredItem}" | Remaining: ${stockLines.length - 1}`);

        // Remove first item and update product stock
        const remainingStock = stockLines.slice(1).join("\n");
        
        await storage.updateProduct(item.productId, { 
          stock: remainingStock,
        });

        // Save delivered content per item for redemption
        await storage.updateOrderItem(item.id, {
          deliveredContent: deliveredItem,
        });

        console.log(`[Vendor Approve] Product stock updated. Remaining items: ${stockLines.length - 1}`);
      }

      // Mark order as paid and save delivered content
      const updatedOrder = await storage.updateOrder(orderId, {
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });

      // ========== ATUALIZAR SALDO DO REVENDEDOR ==========
      try {
        if (order.resellerId) {
          const reseller = await storage.getReseller(order.resellerId);
          if (reseller) {
            const valorVenda = parseFloat(order.totalAmount as string || "0");
            const currentBalance = parseFloat(reseller.walletBalance as string || "0");
            
            // Calcular taxa de 10% para produtos premium
            let taxaPremium = 0;
            for (const item of orderItems) {
              const product = await storage.getProduct(item.productId);
              if (product && product.isPremium) {
                const itemValue = parseFloat(item.price as string || "0") * (item.quantity || 1);
                taxaPremium += itemValue * 0.10; // 10% de taxa
              }
            }
            
            // Valor líquido = valor da venda - taxa premium
            const valorLiquido = valorVenda - taxaPremium;
            const newBalance = currentBalance + valorLiquido;

            await storage.updateReseller(order.resellerId, {
              walletBalance: newBalance.toFixed(2),
              totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
              totalCommission: (parseFloat(reseller.totalCommission as string || "0") + taxaPremium).toFixed(2),
            });
            
            if (taxaPremium > 0) {
              console.log(`[Vendor Approve] ✓ Taxa premium aplicada: R$ ${taxaPremium.toFixed(2)} (10%)`);
            }
            console.log(`[Vendor Approve] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
          }
        }
      } catch (walletError: any) {
        console.error("[Vendor Approve] Erro ao atualizar saldo:", walletError.message);
      }

      // Send delivery email automatically
      if (order.email) {
        const productNames = orderItems.map((item: any) => item.productName || "Produto Digital").join(", ");
        const settings = readSettings();
        sendDeliveryEmail({
          to: order.email,
          orderId,
          productName: productNames,
          deliveredContent: deliveredContent.trim(),
          storeName: settings?.storeName || "Nossa Loja",
        }).then(result => {
          if (result.success) {
            console.log(`[Vendor Approve] ✓ Email sent to ${order.email}`);
          } else {
            console.error(`[Vendor Approve] ❌ Email failed: ${result.error}`);
          }
        });
      }

      console.log("[Vendor Approve] Order approved successfully:", orderId);

      res.json({
        success: true,
        status: "paid",
        deliveredContent: deliveredContent.trim(),
        message: "Pedido aprovado com sucesso",
      });
    } catch (error) {
      console.error("[Vendor Approve] CRITICAL ERROR:", error);
      res.status(500).json({ error: "Falha ao aprovar pedido. Detalhes: " + (error as any).message });
    }
  });

  // Public Reseller Info (for checkout)
  app.get("/api/resellers/:id", async (req, res) => {
    const resellerId = parseInt(req.params.id);

    try {
      const reseller = await storage.getReseller(resellerId);
      if (!reseller) {
        return res.status(404).json({ error: "Reseller not found" });
      }

      res.json({
        id: reseller.id,
        storeName: reseller.storeName,
        themeColor: reseller.themeColor,
        pixKey: reseller.pixKey,
        phone: reseller.phone,
        cpf: reseller.cpf,
      });
    } catch (error) {
      console.error("[Reseller Info] Error:", error);
      res.status(500).json({ error: "Failed to fetch reseller info" });
    }
  });

  // Public Reseller Products - Get products by reseller slug (for /loja/:slug page)
  // IMPORTANT: This route MUST come before /api/reseller/:slug to avoid route conflict
  app.get("/api/reseller/products/:slug", async (req, res) => {
    const slug = req.params.slug;
    console.log("[Reseller Products] ========== PUBLIC STORE REQUEST ==========");
    console.log("[Reseller Products] Fetching products for slug:", slug);

    try {
      const reseller = await storage.getResellerBySlug(slug);
      if (!reseller) {
        console.log("[Reseller Products] Reseller not found:", slug);
        return res.status(404).json({ error: "Reseller not found" });
      }

      console.log("[Reseller Products] Found reseller:", { id: reseller.id, storeName: reseller.storeName });

      const products = await storage.getResellerProducts(reseller.id);
      console.log("[Reseller Products] Total products in DB for reseller:", products.length);
      
      // Debug: Log each product's visibility status
      products.forEach((p: any) => {
        console.log(`[Reseller Products] Product ID ${p.id}: "${p.name}" - active: ${p.active}, hasStock: ${p.stock ? 'yes' : 'no'}`);
      });

      const activeProducts = products.filter((p: { active: boolean }) => p.active);
      
      console.log("[Reseller Products] Active products (filtered):", activeProducts.length, "for", reseller.storeName);
      console.log("[Reseller Products] ========================================");
      res.json(activeProducts);
    } catch (error) {
      console.error("[Reseller Products] Error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Public Reseller Store - Get reseller by slug (for /loja/:slug page)
  app.get("/api/reseller/:slug", async (req, res) => {
    const slug = req.params.slug;
    console.log("[Reseller Store] Fetching reseller by slug:", slug);

    try {
      const reseller = await storage.getResellerBySlug(slug);
      if (!reseller) {
        console.log("[Reseller Store] Reseller not found:", slug);
        return res.status(404).json({ error: "Reseller not found" });
      }

      console.log("[Reseller Store] Found reseller:", reseller.storeName);
      console.log("[Reseller Store] Theme colors:", {
        backgroundColor: reseller.backgroundColor,
        buttonColor: reseller.buttonColor,
        textColor: reseller.textColor,
        cardBackgroundColor: reseller.cardBackgroundColor,
        secondaryColor: reseller.secondaryColor,
      });
      
      // Return public info for store page including all theme colors
      res.json({
        id: reseller.id,
        storeName: reseller.storeName,
        logoUrl: reseller.logoUrl,
        themeColor: reseller.themeColor,
        backgroundColor: reseller.backgroundColor,
        buttonColor: reseller.buttonColor,
        textColor: reseller.textColor,
        cardBackgroundColor: reseller.cardBackgroundColor,
        secondaryColor: reseller.secondaryColor,
        slug: reseller.slug,
        active: reseller.active,
        subscriptionStatus: reseller.subscriptionStatus,
        supportEmail: reseller.supportEmail,
        whatsappContact: reseller.whatsappContact,
        footerDescription: reseller.footerDescription,
        faviconUrl: reseller.faviconUrl,
        storeDescription: reseller.storeDescription,
      });
    } catch (error) {
      console.error("[Reseller Store] Error:", error);
      res.status(500).json({ error: "Failed to fetch reseller" });
    }
  });

  // Admin Resellers Route - GET all resellers with is_reseller = true filter
  app.get("/api/admin/resellers", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    console.log("\n[Admin Resellers] 🔍 REQUEST START");
    console.log("[Admin Resellers] Authorization header:", req.headers.authorization);
    console.log("[Admin Resellers] Token extracted:", token);
    console.log("[Admin Resellers] VALID_ADMIN_TOKEN:", VALID_ADMIN_TOKEN);
    console.log("[Admin Resellers] Token matches VALID_ADMIN_TOKEN?:", token === VALID_ADMIN_TOKEN);
    console.log("[Admin Resellers] Admin tokens in memory (Set size):", adminTokens.size);
    console.log("[Admin Resellers] Is token authenticated?:", isAuthenticated(token));
    
    if (!isAuthenticated(token)) {
      console.log("[Admin Resellers] ❌ UNAUTHORIZED - returning 401");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("[Admin Resellers] ✅ Token authenticated, proceeding with query...");
    
    try {
      console.log("[Admin Resellers] 📊 Calling storage.getAllResellers()...");
      const resellersList = await storage.getAllResellers();
      
      console.log("[Admin Resellers] ✅ QUERY EXECUTED SUCCESSFULLY");
      console.log("[Admin Resellers] 📈 Total revendedores returned:", resellersList.length);
      
      if (resellersList.length === 0) {
        console.log("[Admin Resellers] ⚠️ WARNING: Query returned 0 resellers!");
      } else {
        console.log("[Admin Resellers] 📋 Revendedores encontrados:");
        resellersList.forEach(r => {
          console.log(`  - ID: ${r.id}, Name: ${r.storeName}, Email: ${r.email}, Products: ${r.productCount}, Active: ${r.active}`);
        });
      }
      
      console.log("[Admin Resellers] 🔗 Sending response to client...");
      res.json(resellersList);
      console.log("[Admin Resellers] 🟢 REQUEST COMPLETE\n");
    } catch (error) {
      console.error("[Admin Resellers] ❌ ERROR during execution:", error);
      console.error("[Admin Resellers] Error type:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Failed to fetch resellers", details: String(error) });
    }
  });

  // Admin Ban Reseller
  app.patch("/api/admin/resellers/:id/ban", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resellerId = parseInt(req.params.id);
    try {
      await storage.updateReseller(resellerId, { active: false });
      res.json({ success: true, message: "Reseller blocked" });
    } catch (error) {
      console.error("[Admin Ban] Error:", error);
      res.status(500).json({ error: "Failed to block reseller" });
    }
  });

  // Admin Unban Reseller
  app.patch("/api/admin/resellers/:id/unban", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resellerId = parseInt(req.params.id);
    try {
      await storage.updateReseller(resellerId, { active: true });
      res.json({ success: true, message: "Reseller unblocked" });
    } catch (error) {
      console.error("[Admin Unban] Error:", error);
      res.status(500).json({ error: "Failed to unblock reseller" });
    }
  });

  // Admin Delete Reseller
  app.delete("/api/admin/resellers/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resellerId = parseInt(req.params.id);
    try {
      // Delete all products for this reseller
      const products = await storage.getResellerProducts(resellerId);
      for (const product of products) {
        await storage.deleteProduct(product.id);
      }
      
      // Delete all orders for this reseller
      const orders = await storage.getResellerOrders(resellerId);
      for (const order of orders) {
        await storage.deleteOrder(order.id);
      }
      
      // Delete the reseller
      await storage.deleteReseller(resellerId);
      res.json({ success: true, message: "Reseller and all associated data deleted" });
    } catch (error) {
      console.error("[Admin Delete] Error:", error);
      res.status(500).json({ error: "Failed to delete reseller" });
    }
  });

  // Subscription Activation Route (Admin only) - by reseller ID
  app.put("/api/admin/resellers/:id/activate-sub", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    console.log("[🟢 Activate Sub] Step 1 - Token validation");
    if (!isAuthenticated(token)) {
      console.log("[🟢 Activate Sub] ❌ Token invalid");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const resellerId = parseInt(req.params.id);
    console.log(`[🟢 Activate Sub] Step 2 - Ativando utilizador ID: ${resellerId}`);
    
    if (!resellerId || isNaN(resellerId)) {
      console.log("[🟢 Activate Sub] ❌ Invalid reseller ID");
      return res.status(400).json({ error: "Invalid reseller ID" });
    }

    try {
      // PASSO 1: Calcular data de expiração (30 dias a partir de AGORA)
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + 30);
      
      console.log(`[🟢 Activate Sub] Step 3 - Cálculo da data:`);
      console.log(`  - Data de ativação: ${new Date().toISOString()}`);
      console.log(`  - Data de expiração: ${expiresDate.toISOString()}`);
      
      // PASSO 2: Atualizar no banco com dados explícitos
      console.log("[🟢 Activate Sub] Step 4 - Atualizando REVENDEDOR no banco...");
      const updatedReseller = await storage.updateReseller(resellerId, {
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresDate,
      });

      if (!updatedReseller) {
        console.error("[🟢 Activate Sub] ❌ Revendedor não encontrado");
        return res.status(404).json({ error: "Reseller not found" });
      }

      console.log("[🟢 Activate Sub] ✅ Revendedor atualizado com SUCESSO");
      console.log("[🟢 Activate Sub] Dados salvos:", {
        id: updatedReseller.id,
        subscriptionStatus: updatedReseller.subscriptionStatus,
        subscriptionExpiresAt: updatedReseller.subscriptionExpiresAt,
      });
      
      // PASSO 3: Retornar usuário ATUALIZADO para o frontend
      res.json({ 
        success: true, 
        message: "Assinatura ativada por 30 dias",
        user: updatedReseller,
        expiresAt: expiresDate
      });
    } catch (error: any) {
      console.error("[🟢 Activate Sub] ❌ ERRO FATAL:", error.message);
      console.error("[🟢 Activate Sub] Stack:", error.stack);
      res.status(500).json({ error: "Failed to activate subscription", details: error.message });
    }
  });

  // Manual subscription activation for vendors (self-service)
  app.post("/api/vendor/activate-subscription-manual", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Unauthorized - Login as vendor first" });
    }

    const vendorId = tokenToVendor.get(token);

    try {
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + 30);
      
      console.log(`[Manual Activation] Activating vendor ${vendorId} for 30 days`);
      
      const updatedReseller = await storage.updateReseller(vendorId!, {
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresDate,
      });

      if (!updatedReseller) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      console.log(`[Manual Activation] Vendor ${vendorId} activated until ${expiresDate.toISOString()}`);
      
      res.json({ 
        success: true, 
        message: "Assinatura ativada por 30 dias",
        expiresAt: expiresDate,
        vendor: {
          id: updatedReseller.id,
          subscriptionStatus: updatedReseller.subscriptionStatus,
          subscriptionExpiresAt: updatedReseller.subscriptionExpiresAt,
        }
      });
    } catch (error: any) {
      console.error("[Manual Activation] Error:", error.message);
      res.status(500).json({ error: "Failed to activate subscription" });
    }
  });

  // Legacy subscription activation route (kept for compatibility)
  app.put("/api/subscription/activate", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { resellerId } = req.body;
    if (!resellerId) {
      return res.status(400).json({ error: "Missing resellerId" });
    }

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await storage.updateReseller(resellerId, {
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresAt,
      });

      res.json({ success: true, message: "Subscription activated for 30 days" });
    } catch (error) {
      console.error("[Subscription Activate] Error:", error);
      res.status(500).json({ error: "Failed to activate subscription" });
    }
  });

  // AbacatePay: Create subscription checkout for vendor
  app.post("/api/abacatepay/create-subscription-checkout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);

    try {
      const vendor = await storage.getReseller(vendorId!);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      const { createPixPayment } = await import("./abacatePayController");
      
      const result = await createPixPayment({
        orderId: vendorId!,
        amount: 10.00,
        email: vendor.email,
        description: "Assinatura Mensal GOLDNET",
        customerName: vendor.name || vendor.email.split("@")[0],
      });

      console.log(`[AbacatePay] Subscription checkout created for vendor ${vendorId}: ${result.billingId}`);
      
      res.json({
        success: true,
        billingId: result.billingId,
        pixCode: result.pixCode,
        checkoutUrl: result.checkoutUrl,
        amount: 10.00,
        vendorId: vendorId,
      });
    } catch (error: any) {
      console.error("[AbacatePay] Error creating subscription checkout:", error.message);
      res.status(500).json({ error: error.message || "Failed to create AbacatePay checkout" });
    }
  });

  // AbacatePay: Verify subscription payment status
  app.post("/api/abacatepay/verify-subscription", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const authenticatedVendorId = tokenToVendor.get(token);
    const { billingId } = req.body;
    
    if (!billingId) {
      return res.status(400).json({ error: "Missing billingId" });
    }

    try {
      const { checkPaymentStatus } = await import("./abacatePayController");
      const result = await checkPaymentStatus(billingId);

      if (result.isPaid && authenticatedVendorId) {
        const expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + 30);
        
        await storage.updateReseller(authenticatedVendorId, {
          subscriptionStatus: "active",
          subscriptionExpiresAt: expiresDate,
        });
        
        console.log(`[AbacatePay] Subscription activated for vendor ${authenticatedVendorId}`);
      }

      res.json({
        success: result.isPaid,
        status: result.status,
        isPaid: result.isPaid,
      });
    } catch (error: any) {
      console.error("[AbacatePay] Error verifying subscription:", error.message);
      res.status(500).json({ error: "Failed to verify subscription" });
    }
  });

  // AbacatePay: Webhook for subscription notifications
  app.post("/api/abacatepay/subscription-webhook", async (req, res) => {
    try {
      const signature = req.headers["x-webhook-signature"] as string || 
                        req.headers["x-abacatepay-signature"] as string || "";
      
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      
      console.log("[AbacatePay Subscription Webhook] Received event:", req.body.event);
      
      const { verifyAbacateSignature, parseWebhookPayload } = await import("./abacatePayController");
      const isValid = verifyAbacateSignature(rawBody, signature);
      if (!isValid) {
        console.error("[AbacatePay Subscription Webhook] Invalid signature");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const webhookData = parseWebhookPayload(req.body);
      
      if (webhookData.isPaid && webhookData.orderId) {
        const vendorId = parseInt(webhookData.orderId);
        if (!isNaN(vendorId)) {
          const expiresDate = new Date();
          expiresDate.setDate(expiresDate.getDate() + 30);
          
          await storage.updateReseller(vendorId, {
            subscriptionStatus: "active",
            subscriptionExpiresAt: expiresDate,
          });
          
          console.log(`[AbacatePay Subscription Webhook] Subscription activated for vendor ${vendorId}`);
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[AbacatePay Subscription Webhook] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // PagSeguro: Create subscription checkout for vendor (Legacy - kept for compatibility)
  app.post("/api/pagseguro/create-subscription-checkout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const vendorId = tokenToVendor.get(token);

    try {
      const vendor = await storage.getReseller(vendorId!);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      const settings = readSettings();
      console.log("[PagSeguro] Settings loaded:", {
        hasToken: !!settings?.pagseguroToken,
        tokenLength: settings?.pagseguroToken?.length,
        tokenPreview: settings?.pagseguroToken?.substring(0, 20) + "...",
        email: settings?.pagseguroEmail,
      });
      
      if (!settings || !settings.pagseguroToken) {
        console.error("[PagSeguro] Token not found in settings.json");
        return res.status(500).json({ error: "PagSeguro not configured - Token missing" });
      }

      const { pagseguroToken } = settings;
      const baseUrl = "https://api.pagseguro.com";

      console.log("[PagSeguro] Using API:", baseUrl, "| PRODUCAO");

      const amountInCents = 1000; // R$ 10,00
      const referenceId = `subscription-vendor-${vendorId}-${Date.now()}`;
      const appBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const orderPayload = {
        reference_id: referenceId,
        customer: {
          name: vendor.name || vendor.email.split("@")[0],
          email: vendor.email,
          tax_id: vendor.cpf || "12345678909",
        },
        items: [
          {
            reference_id: `subscription-item-${vendorId}`,
            name: "Assinatura Mensal GOLDNET",
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
      };

      const axios = (await import("axios")).default;
      const response = await axios.post(
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
      const qrCode = orderData.qr_codes?.[0];

      if (!qrCode) {
        throw new Error("QR Code not returned by PagSeguro");
      }

      const qrCodeImageLink = qrCode.links?.find((link: any) => link.media === "image/png");

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

      console.log(`[PagSeguro] Subscription checkout created for vendor ${vendorId}: ${orderData.id}`);
      
      res.json({
        success: true,
        pagseguroOrderId: orderData.id,
        referenceId: referenceId,
        pixCode: qrCode.text,
        qrCodeBase64: qrCodeBase64,
        qrCodeImageUrl: qrCodeImageLink?.href || null,
        amount: 10.00,
        vendorId: vendorId,
      });
    } catch (error: any) {
      console.error("[PagSeguro] Error creating subscription checkout:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to create PagSeguro checkout" });
    }
  });

  // PagSeguro: Verify subscription payment status (authenticated)
  app.post("/api/pagseguro/verify-subscription", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const authenticatedVendorId = tokenToVendor.get(token);
    const { pagseguroOrderId, vendorId } = req.body;
    
    if (!pagseguroOrderId) {
      return res.status(400).json({ error: "Missing pagseguroOrderId" });
    }

    if (vendorId && parseInt(vendorId) !== authenticatedVendorId) {
      return res.status(403).json({ error: "Vendor ID mismatch" });
    }

    try {
      const settings = readSettings();
      if (!settings || !settings.pagseguroToken) {
        return res.status(500).json({ error: "PagSeguro not configured" });
      }

      const { pagseguroToken } = settings;
      const baseUrl = "https://api.pagseguro.com";

      const axios = (await import("axios")).default;
      const response = await axios.get(
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
      const isPaid = charge?.status === "PAID";

      const referenceId = orderData.reference_id || "";
      const expectedVendorPattern = `subscription-vendor-${authenticatedVendorId}`;
      if (!referenceId.startsWith(expectedVendorPattern)) {
        return res.status(403).json({ error: "Order does not belong to this vendor" });
      }

      const paidAmount = charge?.amount?.value || 0;
      const expectedAmount = 1000;
      if (isPaid && paidAmount < expectedAmount) {
        return res.status(400).json({ error: "Payment amount mismatch" });
      }

      if (isPaid && authenticatedVendorId) {
        const expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + 30);
        
        await storage.updateReseller(authenticatedVendorId, {
          subscriptionStatus: "active",
          subscriptionExpiresAt: expiresDate,
        });
        
        console.log(`[PagSeguro] Subscription activated for vendor ${authenticatedVendorId}`);
      }

      res.json({
        success: isPaid,
        status: charge?.status || "WAITING",
        isPaid: isPaid,
      });
    } catch (error: any) {
      console.error("[PagSeguro] Error verifying subscription:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to verify subscription" });
    }
  });

  // PagSeguro: Webhook for subscription notifications
  app.post("/api/pagseguro/subscription-webhook", async (req, res) => {
    try {
      const { id, charges, reference_id } = req.body;
      
      console.log(`[PagSeguro Webhook] Received notification for order: ${id}`);
      
      const charge = charges?.[0];
      if (charge?.status === "PAID" && reference_id) {
        const vendorIdMatch = reference_id.match(/subscription-vendor-(\d+)/);
        if (vendorIdMatch) {
          const vendorId = parseInt(vendorIdMatch[1]);
          
          const expiresDate = new Date();
          expiresDate.setDate(expiresDate.getDate() + 30);
          
          await storage.updateReseller(vendorId, {
            subscriptionStatus: "active",
            subscriptionExpiresAt: expiresDate,
          });
          
          console.log(`[PagSeguro Webhook] Subscription activated for vendor ${vendorId}`);
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[PagSeguro Webhook] Error:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ========== WITHDRAWAL REQUESTS ROUTES ==========
  
  // Vendor: Create withdrawal request
  // NOVA LÓGICA: Taxa cobrada apenas no saque (não na venda)
  app.post("/api/vendor/withdrawals", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const vendorId = tokenToVendor.get(token)!;
    
    // Taxa fixa de saque - R$ 3,00 descontada do valor sacado
    const TAXA_DE_SAQUE_FIXA = 3.00;
    const MIN_WITHDRAWAL = 5.00; // Mínimo para sacar (valor bruto do saldo)
    
    try {
      const { amount, pixKey, pixKeyType, pixHolderName } = req.body;
      
      // amount = valor que será descontado do saldo (não o valor líquido)
      const valorBrutoSaque = parseFloat(amount);
      
      if (!amount || valorBrutoSaque <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }
      
      if (valorBrutoSaque < MIN_WITHDRAWAL) {
        return res.status(400).json({ error: `O valor mínimo para retirada é R$ ${MIN_WITHDRAWAL.toFixed(2)}` });
      }
      
      if (!pixHolderName || !pixHolderName.trim()) {
        return res.status(400).json({ error: "Nome do titular é obrigatório" });
      }
      
      if (!pixKey) {
        return res.status(400).json({ error: "Chave PIX é obrigatória" });
      }
      
      // Get vendor's available balance
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Revendedor não encontrado" });
      }
      
      const availableBalance = parseFloat(vendor.walletBalance as string || "0");
      
      // Verificar se saldo >= valor solicitado (a taxa é descontada do valor, não adicionada)
      if (valorBrutoSaque > availableBalance) {
        return res.status(400).json({ 
          error: `Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}` 
        });
      }
      
      // Taxa é descontada do valor sacado - o líquido é o que sobra
      // Ex: Saca R$ 7,00 do saldo -> Recebe R$ 4,00 via PIX (7 - 3 de taxa)
      const netAmount = valorBrutoSaque - TAXA_DE_SAQUE_FIXA;
      
      if (netAmount <= 0) {
        return res.status(400).json({ 
          error: `Valor muito baixo. Após a taxa de R$ ${TAXA_DE_SAQUE_FIXA.toFixed(2)}, você receberia R$ ${netAmount.toFixed(2)}. Saque no mínimo R$ ${(TAXA_DE_SAQUE_FIXA + 1).toFixed(2)}` 
        });
      }
      
      // DEDUZIR SALDO IMEDIATAMENTE ao criar a solicitação de saque
      const newBalance = availableBalance - valorBrutoSaque;
      await storage.updateReseller(vendorId, {
        walletBalance: newBalance.toFixed(2),
      });
      
      console.log(`[Withdrawal] Balance deducted immediately: Vendor ${vendorId} walletBalance: R$ ${availableBalance.toFixed(2)} -> R$ ${newBalance.toFixed(2)} (deducted R$ ${valorBrutoSaque.toFixed(2)})`);
      
      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest({
        resellerId: vendorId,
        amount: valorBrutoSaque.toFixed(2), // Valor descontado do saldo
        pixKey,
        pixKeyType: pixKeyType || "cpf",
        pixHolderName: pixHolderName.trim(),
        withdrawalFee: TAXA_DE_SAQUE_FIXA.toFixed(2),
        netAmount: netAmount.toFixed(2), // Valor líquido via PIX (bruto - taxa)
        status: "pending",
      });
      
      console.log(`[Withdrawal] Created request for vendor ${vendorId}: Sacou R$ ${valorBrutoSaque.toFixed(2)} do saldo, taxa R$ ${TAXA_DE_SAQUE_FIXA.toFixed(2)}, líquido via PIX: R$ ${netAmount.toFixed(2)}`);
      
      // Fetch updated vendor data to return with the response
      const updatedVendor = await storage.getReseller(vendorId);
      
      res.json({
        ...withdrawal,
        valorSacadoDoSaldo: valorBrutoSaque.toFixed(2),
        taxaSaque: TAXA_DE_SAQUE_FIXA.toFixed(2),
        valorLiquidoPix: netAmount.toFixed(2),
        updatedVendor: updatedVendor ? {
          id: updatedVendor.id,
          walletBalance: updatedVendor.walletBalance,
          storeName: updatedVendor.storeName,
        } : null,
      });
    } catch (error: any) {
      console.error("[Withdrawal] Error creating request:", error);
      res.status(500).json({ error: "Erro ao criar solicitação de retirada" });
    }
  });
  
  // Vendor: Get own withdrawal requests
  app.get("/api/vendor/withdrawals", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token || !tokenToVendor.has(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const vendorId = tokenToVendor.get(token)!;
    
    try {
      const withdrawals = await storage.getWithdrawalRequestsByReseller(vendorId);
      res.json(withdrawals);
    } catch (error: any) {
      console.error("[Withdrawal] Error fetching requests:", error);
      res.status(500).json({ error: "Erro ao buscar solicitações" });
    }
  });
  
  // Admin: Get all withdrawal requests
  app.get("/api/admin/withdrawals", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    try {
      const withdrawals = await storage.getWithdrawalRequests();
      
      // Enrich with reseller info
      const enrichedWithdrawals = await Promise.all(
        withdrawals.map(async (w) => {
          const reseller = await storage.getReseller(w.resellerId);
          return {
            ...w,
            resellerName: reseller?.storeName || reseller?.name || "Desconhecido",
            resellerEmail: reseller?.email || "",
          };
        })
      );
      
      res.json(enrichedWithdrawals);
    } catch (error: any) {
      console.error("[Withdrawal] Error fetching all requests:", error);
      res.status(500).json({ error: "Erro ao buscar solicitações" });
    }
  });
  
  // Admin: Approve or reject withdrawal request
  app.patch("/api/admin/withdrawals/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Não autorizado" });
    }
    
    const withdrawalId = parseInt(req.params.id);
    const { status, adminNotes } = req.body;
    
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }
    
    try {
      const withdrawal = await storage.getWithdrawalRequest(withdrawalId);
      
      if (!withdrawal) {
        return res.status(404).json({ error: "Solicitação não encontrada" });
      }
      
      if (withdrawal.status !== "pending") {
        return res.status(400).json({ error: "Solicitação já processada" });
      }
      
      // O saldo já foi deduzido no momento da criação do saque
      // Se REJEITADO, devolver o valor ao saldo do revendedor
      if (status === "rejected") {
        const reseller = await storage.getReseller(withdrawal.resellerId);
        if (reseller) {
          const currentBalance = parseFloat(reseller.walletBalance as string || "0");
          const withdrawalAmount = parseFloat(withdrawal.amount); // Total que foi descontado (valor + taxa)
          const newBalance = currentBalance + withdrawalAmount;
          
          await storage.updateReseller(withdrawal.resellerId, {
            walletBalance: newBalance.toFixed(2),
          });
          
          console.log(`[Withdrawal] Rejected ${withdrawalId}: R$ ${withdrawalAmount} returned to vendor ${withdrawal.resellerId}. New walletBalance: R$ ${newBalance.toFixed(2)}`);
        }
      } else if (status === "approved") {
        console.log(`[Withdrawal] Approved ${withdrawalId}: Balance was already deducted at request creation time`);
      }
      
      // Update withdrawal status
      const updated = await storage.updateWithdrawalRequest(withdrawalId, {
        status,
        adminNotes: adminNotes || null,
        processedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error: any) {
      console.error("[Withdrawal] Error updating request:", error);
      res.status(500).json({ error: "Erro ao processar solicitação" });
    }
  });

  // ==============================================
  // CHAT ROUTES - Buyer/Seller Communication
  // ==============================================

  // IMPORTANT: Static routes must come BEFORE dynamic :orderId routes
  
  // Get total unread chat messages count for a buyer (by email)
  app.get("/api/chat/unread-total", async (req, res) => {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }
    
    try {
      const orders = await storage.getOrdersByBuyerEmail(email);
      
      let totalUnread = 0;
      for (const order of orders) {
        const count = await storage.getUnreadMessageCount(order.id, "buyer");
        totalUnread += count;
      }
      
      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("[Chat] Error getting total unread count:", error);
      res.status(500).json({ error: "Erro ao contar mensagens não lidas" });
    }
  });

  // Get total unread chat messages count for a seller/reseller (by resellerId)
  app.get("/api/chat/seller-unread-total", async (req, res) => {
    const resellerId = parseInt(req.query.resellerId as string);
    
    if (isNaN(resellerId)) {
      return res.status(400).json({ error: "ID do revendedor inválido" });
    }
    
    try {
      const orders = await storage.getResellerOrders(resellerId);
      
      let totalUnread = 0;
      for (const order of orders) {
        const count = await storage.getUnreadMessageCount(order.id, "seller");
        totalUnread += count;
      }
      
      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("[Chat] Error getting seller total unread count:", error);
      res.status(500).json({ error: "Erro ao contar mensagens não lidas" });
    }
  });

  // Get chat messages for an order
  app.get("/api/chat/:orderId", async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID do pedido inválido" });
    }
    
    try {
      const messages = await storage.getChatMessages(orderId);
      res.json(messages);
    } catch (error: any) {
      console.error("[Chat] Error fetching messages:", error);
      res.status(500).json({ error: "Erro ao buscar mensagens" });
    }
  });

  // Send a text chat message
  app.post("/api/chat/:orderId", async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { senderId, senderType, senderName, message } = req.body;
    
    console.log("[Chat] POST /api/chat/:orderId received");
    console.log("[Chat] orderId:", orderId);
    console.log("[Chat] senderId:", senderId);
    console.log("[Chat] senderType:", senderType);
    console.log("[Chat] senderName:", senderName);
    console.log("[Chat] message:", message);
    console.log("[Chat] Full body:", JSON.stringify(req.body));
    
    if (isNaN(orderId)) {
      console.log("[Chat] Error: Invalid orderId");
      return res.status(400).json({ error: "ID do pedido inválido" });
    }
    
    if (!senderId || !senderType || !message) {
      console.log("[Chat] Error: Incomplete data - senderId:", !!senderId, "senderType:", !!senderType, "message:", !!message);
      return res.status(400).json({ error: "Dados incompletos" });
    }
    
    if (!["buyer", "seller"].includes(senderType)) {
      return res.status(400).json({ error: "Tipo de remetente inválido" });
    }
    
    try {
      const newMessage = await storage.createChatMessage({
        orderId,
        senderId,
        senderType,
        senderName: senderName || null,
        message,
        attachmentUrl: null,
        attachmentType: null,
        read: false,
      });
      
      res.json(newMessage);
    } catch (error: any) {
      console.error("[Chat] Error sending message:", error);
      res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
  });

  // Send a chat message with attachment
  app.post("/api/chat/:orderId/attachment", upload.single("attachment"), async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { senderId, senderType, senderName, message } = req.body;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID do pedido inválido" });
    }
    
    if (!senderId || !senderType) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    
    if (!["buyer", "seller"].includes(senderType)) {
      return res.status(400).json({ error: "Tipo de remetente inválido" });
    }
    
    try {
      let attachmentUrl: string | null = null;
      let attachmentType: string | null = null;
      
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileExtension = req.file.originalname.split(".").pop() || "jpg";
        const fileName = `chat_${orderId}_${Date.now()}.${fileExtension}`;
        
        const objStorage = await getObjectStorage();
        
        if (objStorage) {
          try {
            await objStorage.uploadFromBytes(fileName, fileBuffer);
            attachmentUrl = `/uploads/${fileName}`;
          } catch (uploadError: any) {
            console.log("[Chat] Object storage upload failed, using local fallback");
            const localPath = path.join(uploadDir, fileName);
            fs.writeFileSync(localPath, fileBuffer);
            attachmentUrl = `/uploads/${fileName}`;
          }
        } else {
          ensureUploadDir();
          const localPath = path.join(uploadDir, fileName);
          fs.writeFileSync(localPath, fileBuffer);
          attachmentUrl = `/uploads/${fileName}`;
        }
        
        attachmentType = req.file.mimetype;
      }
      
      const newMessage = await storage.createChatMessage({
        orderId,
        senderId,
        senderType,
        senderName: senderName || null,
        message: message || null,
        attachmentUrl,
        attachmentType,
        read: false,
      });
      
      res.json(newMessage);
    } catch (error: any) {
      console.error("[Chat] Error sending attachment:", error);
      res.status(500).json({ error: "Erro ao enviar anexo" });
    }
  });

  // Mark messages as read
  app.post("/api/chat/:orderId/read", async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const { senderType } = req.body;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID do pedido inválido" });
    }
    
    if (!senderType || !["buyer", "seller"].includes(senderType)) {
      return res.status(400).json({ error: "Tipo de remetente inválido" });
    }
    
    try {
      await storage.markMessagesAsRead(orderId, senderType);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Chat] Error marking messages as read:", error);
      res.status(500).json({ error: "Erro ao marcar mensagens como lidas" });
    }
  });

  // Get unread message count for a specific order
  app.get("/api/chat/:orderId/unread", async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const forSenderType = req.query.for as string;
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID do pedido inválido" });
    }
    
    if (!forSenderType || !["buyer", "seller"].includes(forSenderType)) {
      return res.status(400).json({ error: "Tipo de remetente inválido" });
    }
    
    try {
      const count = await storage.getUnreadMessageCount(orderId, forSenderType);
      res.json({ count });
    } catch (error: any) {
      console.error("[Chat] Error getting unread count:", error);
      res.status(500).json({ error: "Erro ao contar mensagens não lidas" });
    }
  });

  // ==============================================
  // REVIEWS ROUTES - Seller Reviews
  // ==============================================

  // Create a review for an order
  app.post("/api/reviews", async (req, res) => {
    const { orderId, rating, comment, customerEmail, customerName, productId, productName } = req.body;
    
    if (!orderId || !rating || !customerEmail) {
      return res.status(400).json({ error: "Dados incompletos" });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Avaliacao deve ser de 1 a 5" });
    }
    
    try {
      // Check if order exists and is paid
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: "Pedido nao encontrado" });
      }
      
      if (order.status !== "paid") {
        return res.status(400).json({ error: "Apenas pedidos pagos podem ser avaliados" });
      }
      
      if (order.email !== customerEmail) {
        return res.status(403).json({ error: "Voce nao pode avaliar este pedido" });
      }
      
      // Check if already reviewed
      const existingReview = await storage.getReviewByOrderId(orderId);
      if (existingReview) {
        return res.status(400).json({ error: "Este pedido ja foi avaliado" });
      }
      
      const review = await storage.createReview({
        orderId,
        resellerId: order.resellerId!,
        productId: productId || null,
        productName: productName || null,
        rating,
        comment: comment || null,
        customerEmail,
        customerName: customerName || null,
      });
      
      res.json(review);
    } catch (error: any) {
      console.error("[Reviews] Error creating review:", error);
      res.status(500).json({ error: "Erro ao criar avaliacao" });
    }
  });

  // Check if an order has been reviewed
  app.get("/api/reviews/order/:orderId", async (req, res) => {
    const orderId = parseInt(req.params.orderId);
    
    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID do pedido invalido" });
    }
    
    try {
      const review = await storage.getReviewByOrderId(orderId);
      res.json(review || null);
    } catch (error: any) {
      console.error("[Reviews] Error checking review:", error);
      res.status(500).json({ error: "Erro ao verificar avaliacao" });
    }
  });

  // Get all reviews by customer email
  app.get("/api/reviews/by-email", async (req, res) => {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }
    
    try {
      const reviews = await storage.getReviewsByCustomerEmail(email);
      res.json(reviews);
    } catch (error: any) {
      console.error("[Reviews] Error fetching customer reviews:", error);
      res.status(500).json({ error: "Erro ao buscar avaliações do cliente" });
    }
  });

  // Get all reviews for a seller
  app.get("/api/reviews/seller/:resellerId", async (req, res) => {
    const resellerId = parseInt(req.params.resellerId);
    
    if (isNaN(resellerId)) {
      return res.status(400).json({ error: "ID do vendedor invalido" });
    }
    
    try {
      const reviews = await storage.getResellerReviews(resellerId);
      res.json(reviews);
    } catch (error: any) {
      console.error("[Reviews] Error fetching seller reviews:", error);
      res.status(500).json({ error: "Erro ao buscar avaliacoes" });
    }
  });

  // Get all reviews for a product
  app.get("/api/reviews/product/:productId", async (req, res) => {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID do produto invalido" });
    }
    
    try {
      const reviews = await storage.getProductReviews(productId);
      res.json(reviews);
    } catch (error: any) {
      console.error("[Reviews] Error fetching product reviews:", error);
      res.status(500).json({ error: "Erro ao buscar avaliacoes do produto" });
    }
  });

  // Get seller stats (rating, sales count, positive percentage)
  app.get("/api/seller/:resellerId/stats", async (req, res) => {
    const resellerId = parseInt(req.params.resellerId);
    
    if (isNaN(resellerId)) {
      return res.status(400).json({ error: "ID do vendedor invalido" });
    }
    
    try {
      const stats = await storage.getResellerStats(resellerId);
      res.json(stats);
    } catch (error: any) {
      console.error("[Reviews] Error fetching seller stats:", error);
      res.status(500).json({ error: "Erro ao buscar estatisticas" });
    }
  });

  // Get seller profile by slug with products and stats
  app.get("/api/seller/:slug/profile", async (req, res) => {
    const slug = req.params.slug;
    
    try {
      const reseller = await storage.getResellerBySlug(slug);
      
      if (!reseller) {
        return res.status(404).json({ error: "Vendedor nao encontrado" });
      }
      
      const products = await storage.getResellerProducts(reseller.id);
      const activeProducts = products.filter(p => p.active);
      const stats = await storage.getResellerStats(reseller.id);
      const reviews = await storage.getResellerReviews(reseller.id);
      
      res.json({
        id: reseller.id,
        name: reseller.name,
        storeName: reseller.storeName,
        slug: reseller.slug,
        logoUrl: reseller.logoUrl,
        storeDescription: reseller.storeDescription,
        whatsappContact: reseller.whatsappContact,
        stats,
        products: activeProducts,
        reviews: reviews.slice(0, 10),
      });
    } catch (error: any) {
      console.error("[Reviews] Error fetching seller profile:", error);
      res.status(500).json({ error: "Erro ao buscar perfil do vendedor" });
    }
  });

  return httpServer;
}

