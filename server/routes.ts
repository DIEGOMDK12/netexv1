import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated as isCustomerAuthenticated } from "./replitAuth";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { sendDeliveryEmail } from "./email";
import {
  generateAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  createPixOrder,
  checkOrderStatus,
  parseWebhook as parsePagseguroWebhook,
} from "./pagseguroConnectController";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: multerStorage,
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

function isVendorAuthenticated(token: string | undefined): boolean {
  return token ? tokenToVendor.has(token) : false;
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
      storeName: "NexStore",
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
      supportEmail: "suporte@nexstore.com",
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

  // Setup customer authentication (Google, GitHub, Apple, etc)
  await setupAuth(app);

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

  app.post("/api/upload", upload.single("image"), (req, res) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      
      if (!isAuthenticated(token) && !isVendorAuthenticated(token)) {
        console.log("[POST /api/upload] Unauthorized upload attempt");
        return res.status(401).json({ error: "Não autorizado. Faça login para fazer upload de imagens." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Nenhuma imagem enviada" });
      }
      const imageUrl = `/uploads/${req.file.filename}`;
      console.log("[POST /api/upload] Image uploaded:", imageUrl);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("[POST /api/upload] Error:", error);
      res.status(500).json({ error: error.message || "Erro ao fazer upload da imagem" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      // Return ALL products (including out of stock), but exclude deleted ones
      // Product visibility logic moved to frontend - show all, even with stock=0
      console.log("[GET /api/products] Returning", products.length, "products (including out of stock)");
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const products = await storage.getProducts();
      const product = products.find(p => p.id === id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
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
      storeName: storeName || currentSettings.storeName || "NexStore",
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
          console.log(`[POST /api/admin/orders/:id/approve] ✓ Delivered: ${stockLines[0]}`);

          // Remove the first line from stock and update
          const remainingStock = stockLines.slice(1).join("\n");
          await storage.updateProduct(item.productId, { stock: remainingStock });
          console.log(`[POST /api/admin/orders/:id/approve] ✓ Stock updated. Remaining lines: ${stockLines.length - 1}`);
        } else {
          console.log(`[POST /api/admin/orders/:id/approve] ⚠️ Product ${item.productId} has no stock field`);
        }
      }

      // Mark order as paid and save delivered content
      await storage.updateOrder(orderId, {
        status: "paid",
        deliveredContent: deliveredContent.trim(),
      });

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
            console.log(`[POST /api/admin/orders/:id/approve] ✓ Email sent to ${order.email}`);
          } else {
            console.error(`[POST /api/admin/orders/:id/approve] ❌ Email failed: ${result.error}`);
          }
        });
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
      if (!code) {
        return res.json({ valid: false });
      }

      const coupon = await storage.getCouponByCode(code.toUpperCase());
      if (coupon && coupon.active) {
        res.json({ valid: true, discountPercent: coupon.discountPercent });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to validate coupon" });
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
          console.log(`[POST /api/orders] Creating item: productId=${item.productId}, quantity=1 (FORCED)`);
          await storage.createOrderItem({
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            price: item.price,
            quantity: 1, // FORCED: Digital products are always qty=1
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
      const { valor, id_produto, id_revendedor, email, customerName, customerCpf, whatsapp } = req.body;

      console.log("[AbacatePay] /api/pagamento/criar - Request:", { valor, id_produto, id_revendedor, email });

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

      // Criar pedido no banco
      const order = await storage.createOrder({
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

      // Criar item do pedido
      await storage.createOrderItem({
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        price: valorTotal.toFixed(2),
        quantity: 1,
      });

      console.log(`[AbacatePay] Pedido ${order.id} criado com split`);

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

  // ============== NEW ABACATEPAY WEBHOOK (RECOMMENDED) ==============
  // Webhook para confirmar pagamento e adicionar saldo na carteira do revendedor
  // POST /api/webhook/abacatepay
  app.post("/api/webhook/abacatepay", async (req, res) => {
    try {
      // Validar secret via query param (método simples) ou header (método HMAC)
      const webhookSecret = req.query.webhookSecret as string;
      const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET || process.env.ABACATEPAY_API_KEY;

      // Verificação por query param (mais simples)
      if (webhookSecret && expectedSecret && webhookSecret !== expectedSecret) {
        console.error("[AbacatePay Webhook] Invalid webhook secret");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payload = req.body;
      console.log("[AbacatePay Webhook] Received event:", payload.event);
      console.log("[AbacatePay Webhook] Full payload:", JSON.stringify(payload, null, 2));

      // Verificar se é evento de pagamento confirmado
      const isPaid = payload.event === "billing.paid" || 
                     payload.event === "BILLING.PAID" ||
                     payload.event === "payment.confirmed";

      if (!isPaid) {
        console.log("[AbacatePay Webhook] Event ignored (not a payment confirmation):", payload.event);
        return res.status(200).json({ received: true, action: "ignored" });
      }

      // Extrair orderId dos metadados ou externalId do produto
      let orderId: number | null = null;
      
      // Tentar extrair do metadata
      if (payload.data?.billing?.metadata?.orderId) {
        orderId = parseInt(payload.data.billing.metadata.orderId);
      }
      // Tentar extrair do externalId do produto (formato: "order-123")
      else if (payload.data?.billing?.products?.[0]?.externalId) {
        const externalId = payload.data.billing.products[0].externalId;
        if (externalId.startsWith("order-")) {
          orderId = parseInt(externalId.replace("order-", ""));
        }
      }
      // Tentar buscar pelo billingId
      else if (payload.data?.billing?.id || payload.data?.pixQrCode?.id) {
        const billingId = payload.data?.billing?.id || payload.data?.pixQrCode?.id;
        const orders = await storage.getOrders();
        const matchingOrder = orders.find((o: any) => o.abacatepayBillingId === billingId);
        if (matchingOrder) {
          orderId = matchingOrder.id;
        }
      }

      if (!orderId) {
        console.error("[AbacatePay Webhook] Could not extract orderId from payload");
        return res.status(200).json({ received: true, error: "No orderId found" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`[AbacatePay Webhook] Order ${orderId} not found`);
        return res.status(200).json({ received: true, error: "Order not found" });
      }

      // Verificar se já foi processado
      if (order.status === "paid") {
        console.log(`[AbacatePay Webhook] Order ${orderId} already paid, skipping`);
        return res.status(200).json({ received: true, action: "already_paid" });
      }

      console.log(`[AbacatePay Webhook] Processing payment for order ${orderId}`);

      // 1. ENTREGAR PRODUTO
      const orderItems = await storage.getOrderItems(orderId);
      let deliveredContent = "";

      for (const item of orderItems) {
        const product = await storage.getProduct(item.productId);
        const quantity = item.quantity || 1;

        if (product && product.stock) {
          const stockLines = product.stock.split("\n").filter((line: string) => line.trim());

          if (stockLines.length >= quantity) {
            // FIFO: Pegar quantidade de itens do estoque
            for (let i = 0; i < quantity; i++) {
              deliveredContent += stockLines[i] + "\n";
            }
            // Remover linhas entregues do estoque
            const remainingStock = stockLines.slice(quantity).join("\n");
            await storage.updateProduct(item.productId, { stock: remainingStock });
            console.log(`[AbacatePay Webhook] ✓ Delivered ${quantity} item(s) for product ${product.name}`);
          } else {
            console.error(`[AbacatePay Webhook] ❌ Insufficient stock for ${product.name}`);
          }
        }
      }

      // 2. ATUALIZAR STATUS DO PEDIDO
      const settings = readSettings();
      const storeName = settings?.storeName || "NexStore";
      const whatsappMessage = `Ola! Seu pagamento foi confirmado. Aqui esta sua entrega do pedido #${orderId} na ${storeName}:\n\n${deliveredContent.trim()}\n\nObrigado pela compra!`;
      const whatsappLink = order.whatsapp 
        ? generateWhatsAppLink(order.whatsapp, whatsappMessage)
        : null;

      await storage.updateOrder(orderId, {
        status: "paid",
        deliveredContent: deliveredContent.trim(),
        whatsappDeliveryLink: whatsappLink,
      });

      // 3. ADICIONAR SALDO NA CARTEIRA DO REVENDEDOR (100% DO VALOR - TAXA COBRADA NO SAQUE)
      // Nova lógica: 100% do valor da venda vai para o saldo do revendedor
      // A taxa da plataforma é cobrada apenas no momento do SAQUE
      if (order.resellerId) {
        const reseller = await storage.getReseller(order.resellerId);
        if (reseller) {
          const valorVenda = parseFloat(order.totalAmount as string || "0");
          const currentBalance = parseFloat(reseller.walletBalance as string || "0");
          const newBalance = currentBalance + valorVenda;

          await storage.updateReseller(order.resellerId, {
            walletBalance: newBalance.toFixed(2),
            totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
            totalCommission: (parseFloat(reseller.totalCommission as string || "0") + valorVenda).toFixed(2),
          });

          console.log(`[AbacatePay Webhook] ✅ Reseller ${order.resellerId} balance updated: +R$${valorVenda.toFixed(2)} (100% da venda) (New balance: R$${newBalance.toFixed(2)})`);
        }
      }

      // 4. ENVIAR EMAIL DE ENTREGA
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
            console.log(`[AbacatePay Webhook] ✓ Email sent to ${order.email}`);
          } else {
            console.error(`[AbacatePay Webhook] ❌ Email failed: ${result.error}`);
          }
        });
      }

      console.log(`[AbacatePay Webhook] ✅ Order ${orderId} fully processed`);

      res.status(200).json({ 
        received: true, 
        orderId,
        status: "paid",
        productDelivered: true,
        resellerBalanceUpdated: !!order.resellerId,
      });
    } catch (error: any) {
      console.error("[AbacatePay Webhook] Error:", error.message);
      res.status(500).json({ error: error.message });
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
          const storeName = settings?.storeName || "NexStore";
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

  app.post("/api/admin/products", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      console.log("[POST /api/admin/products] Full request body:", JSON.stringify(req.body, null, 2));
      
      // Extract only the fields that exist in the database
      const productData = {
        name: req.body.name,
        description: req.body.description || null,
        imageUrl: req.body.imageUrl || null,
        originalPrice: req.body.originalPrice,
        currentPrice: req.body.currentPrice,
        stock: req.body.stock || "",
        category: req.body.category || "Outros",
        active: req.body.active ?? true,
      };
      
      console.log("[POST /api/admin/products] Creating with data:", JSON.stringify(productData, null, 2));
      const product = await storage.createProduct(productData);
      console.log("[POST /api/admin/products] Successfully created product:", product);
      res.json(product);
    } catch (error) {
      const errorObj = error as any;
      console.error("[POST /api/admin/products] CRITICAL ERROR:", {
        message: errorObj.message,
        code: errorObj.code,
        detail: errorObj.detail,
        column: errorObj.column,
        table: errorObj.table,
        constraint: errorObj.constraint,
        fullError: errorObj.toString(),
      });
      res.status(500).json({ error: "Failed to create product: " + errorObj.message });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!isAuthenticated(token)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const id = parseInt(req.params.id);
      const updateData = {
        name: req.body.name,
        description: req.body.description || null,
        imageUrl: req.body.imageUrl || null,
        originalPrice: req.body.originalPrice,
        currentPrice: req.body.currentPrice,
        stock: req.body.stock || "",
        category: req.body.category || "Outros",
        active: req.body.active,
      };
      console.log("[PUT /api/admin/products/:id] Updating product", id, "with:", updateData);
      const product = await storage.updateProduct(id, updateData);
      res.json(product);
    } catch (error) {
      const errorObj = error as any;
      console.error("[PUT /api/admin/products/:id] CRITICAL ERROR:", {
        message: errorObj.message,
        code: errorObj.code,
        detail: errorObj.detail,
      });
      res.status(500).json({ error: "Failed to update product: " + errorObj.message });
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
      vendorTokens.set(vendor.id, token);
      tokenToVendor.set(token, vendor.id);

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
        totalSales: vendor.totalSales,
        totalCommission: vendor.totalCommission,
        subscriptionStatus: vendor.subscriptionStatus || "inactive",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        pagseguroToken: vendor.pagseguroToken || null,
        pagseguroEmail: vendor.pagseguroEmail || null,
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

    const { storeName, pixKey, pixKeyType, pixHolderName, pagseguroToken, pagseguroEmail } = req.body;

    try {
      const updateData: any = {};
      if (storeName !== undefined) updateData.storeName = storeName;
      if (pixKey !== undefined) updateData.pixKey = pixKey;
      if (pagseguroToken !== undefined) updateData.pagseguroToken = pagseguroToken;
      if (pagseguroEmail !== undefined) updateData.pagseguroEmail = pagseguroEmail;
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
        totalSales: vendor.totalSales,
        totalCommission: vendor.totalCommission,
        subscriptionStatus: vendor.subscriptionStatus || "inactive",
        subscriptionExpiresAt: vendor.subscriptionExpiresAt,
        pagseguroToken: vendor.pagseguroToken || null,
        pagseguroEmail: vendor.pagseguroEmail || null,
        pagseguroSandbox: false,
        preferredPaymentMethod: vendor.preferredPaymentMethod || "pagseguro",
      });
    } catch (error) {
      console.error("[Vendor Profile] Error:", error);
      res.status(500).json({ error: "Failed to fetch vendor profile" });
    }
  });

  // Vendor Products Routes
  app.get("/api/vendor/products", async (req, res) => {
    const vendorId = parseInt(req.query.vendorId as string);
    
    console.log("[Vendor Products GET] vendorId from query:", vendorId, "raw query:", req.query);
    
    if (!vendorId) {
      console.log("[Vendor Products GET] Missing vendorId - returning ALL products for debugging");
      try {
        const allProducts = await storage.getProducts();
        console.log("[Vendor Products GET] Returning all products:", allProducts.length);
        return res.json(allProducts);
      } catch (error) {
        return res.status(500).json({ error: "Failed to fetch products" });
      }
    }

    try {
      console.log("[Vendor Products GET] Fetching products for vendor:", vendorId);
      const products = await storage.getResellerProducts(vendorId);
      console.log("[Vendor Products GET] Found products:", products.length);
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

  app.post("/api/vendor/products", async (req, res) => {
    const { name, description, imageUrl, originalPrice, currentPrice, stock, category, resellerId, deliveryContent } = req.body;

    console.log("[Create Product] Request body:", { 
      name, 
      resellerId,
      deliveryContent: deliveryContent ? deliveryContent.substring(0, 50) : "MISSING"
    });

    if (!resellerId) {
      console.error("[Create Product] Missing resellerId!");
      return res.status(400).json({ error: "Missing resellerId" });
    }

    try {
      // Auto-count stock items: count non-empty lines
      const stockItems = stock 
        ? stock.split("\n").filter(line => line.trim()).length 
        : 0;

      console.log("[Create Product] Auto-counted stock items:", stockItems, "from stock string");

      // Auto-create or get category
      let categoryId: number | undefined;
      if (category && category.trim()) {
        let cat = await storage.getCategoryByName(category);
        if (!cat) {
          cat = await storage.createCategory({ name: category, slug: category.toLowerCase().replace(/\s+/g, "-") });
        }
        categoryId = cat.id;
      }

      const product = await storage.createResellerProduct({
        name,
        description,
        imageUrl,
        originalPrice,
        currentPrice,
        stock: stock || "", // Keep original text for FIFO
        deliveryContent: deliveryContent || "",
        category: category || "Outros",
        categoryId,
        active: stockItems > 0, // Auto-set active based on stock
        resellerId,
      });

      console.log("[Create Product] Product created successfully:", { id: product.id, resellerId: product.resellerId, stockCount: stockItems });
      res.json(product);
    } catch (error) {
      console.error("[Create Product] Error:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/vendor/products/:id", async (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, description, imageUrl, currentPrice, originalPrice, stock, category, deliveryContent } = req.body;

    console.log("[Update Product] Updating product", productId, "with:", { name, deliveryContent: deliveryContent ? deliveryContent.substring(0, 50) : "MISSING" });

    try {
      // Auto-count stock items: count non-empty lines
      const stockItems = stock 
        ? stock.split("\n").filter(line => line.trim()).length 
        : 0;

      console.log("[Update Product] Auto-counted stock items:", stockItems, "from stock string");

      // Auto-create or get category
      let categoryId: number | undefined;
      if (category && category.trim()) {
        let cat = await storage.getCategoryByName(category);
        if (!cat) {
          cat = await storage.createCategory({ name: category, slug: category.toLowerCase().replace(/\s+/g, "-") });
        }
        categoryId = cat.id;
      }

      const product = await storage.updateProduct(productId, {
        name,
        description,
        imageUrl,
        currentPrice,
        originalPrice,
        stock: stock || "", // Keep original text for FIFO
        deliveryContent: deliveryContent || "",
        category: category || "Outros",
        categoryId,
        active: stockItems > 0, // Auto-set active based on stock
      });

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
      await storage.deleteProduct(productId);
      res.json({ success: true });
    } catch (error) {
      console.error("[Delete Product] Error:", error);
      res.status(500).json({ error: "Failed to delete product" });
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
        themeColor: vendor.themeColor || "#3B82F6",
        backgroundColor: vendor.backgroundColor || "#121212",
        buttonColor: vendor.buttonColor || "#3B82F6",
        cardBorderColor: vendor.cardBorderColor || "#374151",
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

    const { logoUrl, themeColor, backgroundColor, buttonColor, cardBorderColor, backgroundImageUrl, buttonRadius } = req.body;

    try {
      const updateData: any = {};
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
      if (backgroundColor !== undefined) updateData.backgroundColor = backgroundColor;
      if (buttonColor !== undefined) updateData.buttonColor = buttonColor;
      if (cardBorderColor !== undefined) updateData.cardBorderColor = cardBorderColor;
      if (backgroundImageUrl !== undefined) updateData.backgroundImageUrl = backgroundImageUrl;
      if (buttonRadius !== undefined) updateData.buttonRadius = buttonRadius;

      const vendor = await storage.updateReseller(vendorId, updateData);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({
        logoUrl: vendor.logoUrl || "",
        themeColor: vendor.themeColor || "#3B82F6",
        backgroundColor: vendor.backgroundColor || "#121212",
        buttonColor: vendor.buttonColor || "#3B82F6",
        cardBorderColor: vendor.cardBorderColor || "#374151",
        backgroundImageUrl: vendor.backgroundImageUrl || "",
        buttonRadius: vendor.buttonRadius || 8,
      });
    } catch (error) {
      console.error("[Vendor Appearance PATCH] Error:", error);
      res.status(500).json({ error: "Failed to update appearance settings" });
    }
  });

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
        
        for (const [id, token] of vendorTokens.entries()) {
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
    console.log("[Reseller Products] Fetching products for slug:", slug);

    try {
      const reseller = await storage.getResellerBySlug(slug);
      if (!reseller) {
        console.log("[Reseller Products] Reseller not found:", slug);
        return res.status(404).json({ error: "Reseller not found" });
      }

      const products = await storage.getResellerProducts(reseller.id);
      const activeProducts = products.filter((p: { active: boolean }) => p.active);
      
      console.log("[Reseller Products] Found", activeProducts.length, "active products for", reseller.storeName);
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
      
      // Return public info for store page
      res.json({
        id: reseller.id,
        storeName: reseller.storeName,
        logoUrl: reseller.logoUrl,
        themeColor: reseller.themeColor,
        slug: reseller.slug,
        active: reseller.active,
        subscriptionStatus: reseller.subscriptionStatus,
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
        description: "Assinatura Mensal NexStore",
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
            name: "Assinatura Mensal NexStore",
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
    
    // Taxa fixa de saque - cobrada uma vez por retirada para cobrir custos bancários
    const TAXA_DE_SAQUE_FIXA = 1.60;
    const MIN_WITHDRAWAL = 5.00;
    
    try {
      const { amount, pixKey, pixKeyType, pixHolderName } = req.body;
      
      const numericAmount = parseFloat(amount);
      
      if (!amount || numericAmount <= 0) {
        return res.status(400).json({ error: "Valor inválido" });
      }
      
      if (numericAmount < MIN_WITHDRAWAL) {
        return res.status(400).json({ error: `O valor mínimo para retirada é R$ ${MIN_WITHDRAWAL.toFixed(2)}` });
      }
      
      if (!pixHolderName || !pixHolderName.trim()) {
        return res.status(400).json({ error: "Nome do titular é obrigatório" });
      }
      
      if (!pixKey) {
        return res.status(400).json({ error: "Chave PIX é obrigatória" });
      }
      
      // Get vendor's available balance (usando walletBalance que acumula 100% das vendas)
      const vendor = await storage.getReseller(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "Revendedor não encontrado" });
      }
      
      const availableBalance = parseFloat(vendor.walletBalance as string || "0");
      
      // NOVA LÓGICA: Verificar se saldo >= (valor solicitado + taxa de saque)
      const totalRequired = numericAmount + TAXA_DE_SAQUE_FIXA;
      
      if (totalRequired > availableBalance) {
        return res.status(400).json({ 
          error: `Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}. Necessário: R$ ${totalRequired.toFixed(2)} (R$ ${numericAmount.toFixed(2)} + R$ ${TAXA_DE_SAQUE_FIXA.toFixed(2)} de taxa)` 
        });
      }
      
      // O valor líquido que o revendedor receberá via PIX é o valor solicitado
      // A taxa é descontada do saldo, mas não do valor transferido
      const netAmount = numericAmount; // Valor que será transferido via PIX
      
      // Create withdrawal request
      const withdrawal = await storage.createWithdrawalRequest({
        resellerId: vendorId,
        amount: totalRequired.toFixed(2), // Total descontado do saldo (valor + taxa)
        pixKey,
        pixKeyType: pixKeyType || "cpf",
        pixHolderName: pixHolderName.trim(),
        withdrawalFee: TAXA_DE_SAQUE_FIXA.toFixed(2),
        netAmount: netAmount.toFixed(2), // Valor que será transferido via PIX
        status: "pending",
      });
      
      console.log(`[Withdrawal] Created request for vendor ${vendorId}: Saque R$ ${numericAmount.toFixed(2)} + Taxa R$ ${TAXA_DE_SAQUE_FIXA.toFixed(2)} = Total R$ ${totalRequired.toFixed(2)} (líquido via PIX: R$ ${netAmount.toFixed(2)})`);
      
      res.json({
        ...withdrawal,
        valorSolicitado: numericAmount.toFixed(2),
        taxaSaque: TAXA_DE_SAQUE_FIXA.toFixed(2),
        totalDescontado: totalRequired.toFixed(2),
        valorLiquidoPix: netAmount.toFixed(2),
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
      
      // If approving, deduct from reseller's walletBalance (total incluindo taxa)
      if (status === "approved") {
        const reseller = await storage.getReseller(withdrawal.resellerId);
        if (reseller) {
          const currentBalance = parseFloat(reseller.walletBalance as string || "0");
          const withdrawalAmount = parseFloat(withdrawal.amount); // Já inclui valor + taxa
          const newBalance = Math.max(0, currentBalance - withdrawalAmount);
          
          await storage.updateReseller(withdrawal.resellerId, {
            walletBalance: newBalance.toFixed(2),
          });
          
          console.log(`[Withdrawal] Approved ${withdrawalId}: R$ ${withdrawalAmount} deducted from vendor ${withdrawal.resellerId}. New walletBalance: R$ ${newBalance.toFixed(2)}`);
        }
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

  return httpServer;
}

