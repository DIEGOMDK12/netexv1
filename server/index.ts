import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";
import { storage } from "./storage";

const app = express();
const httpServer = createServer(app);

async function runStartupMigrations() {
  try {
    const client = await pool.connect();
    
    // Add subcategories column to categories table if it doesn't exist
    await client.query(`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS subcategories TEXT[] DEFAULT '{}'
    `);
    console.log("[Migration] Added subcategories column to categories table");
    
    // Add subcategory column to products table if it doesn't exist
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS subcategory TEXT
    `);
    console.log("[Migration] Added subcategory column to products table");
    
    // Add viewedByBuyer column to orders table if it doesn't exist
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS viewed_by_buyer BOOLEAN DEFAULT FALSE
    `);
    console.log("[Migration] Added viewed_by_buyer column to orders table");
    
    // Add document verification columns to resellers table
    await client.query(`
      ALTER TABLE resellers 
      ADD COLUMN IF NOT EXISTS document_front_url TEXT,
      ADD COLUMN IF NOT EXISTS document_back_url TEXT,
      ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS verification_notes TEXT,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP
    `);
    console.log("[Migration] Added verification columns to resellers table");
    
    // Create chat_messages table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        order_id INTEGER NOT NULL,
        sender_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_name TEXT,
        message TEXT,
        attachment_url TEXT,
        attachment_type TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[Migration] Created chat_messages table");
    
    // Create reviews table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        order_id INTEGER NOT NULL UNIQUE,
        reseller_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[Migration] Created reviews table");
    
    // Add product_id and product_name columns to reviews table for product-specific reviews (for existing tables)
    await client.query(`
      ALTER TABLE reviews 
      ADD COLUMN IF NOT EXISTS product_id INTEGER,
      ADD COLUMN IF NOT EXISTS product_name TEXT
    `);
    console.log("[Migration] Added product columns to reviews table");
    
    // Create product_variants table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        product_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        stock TEXT NOT NULL DEFAULT '',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[Migration] Created product_variants table");
    
    // Add active column to product_variants if table already exists but column doesn't
    await client.query(`
      ALTER TABLE product_variants 
      ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE
    `);
    console.log("[Migration] Added active column to product_variants table");
    
    // Add variant_id and variant_name columns to order_items if they don't exist
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN IF NOT EXISTS variant_id INTEGER,
      ADD COLUMN IF NOT EXISTS variant_name TEXT
    `);
    console.log("[Migration] Added variant_id and variant_name columns to order_items table");
    
    client.release();
    console.log("[Migration] Startup migrations completed successfully");
  } catch (error: any) {
    console.error("[Migration] Error running startup migrations:", error.message);
  }
}

runStartupMigrations();

async function seedFixedCategories() {
  try {
    const { storage } = await import("./storage");
    
    const CATEGORIAS_MERCADO = [
      {
        name: "Games Mobile",
        slug: "games-mobile",
        icon: "https://cdn-icons-png.flaticon.com/512/7994/7994396.png",
        displayOrder: 1,
        subcategories: [
          "Free Fire - Diamantes",
          "Free Fire - Contas",
          "Roblox - Robux",
          "Roblox - Contas/Itens",
          "Clash Royale",
          "Brawl Stars",
          "COD Mobile",
          "8 Ball Pool",
          "Outros Jogos Mobile"
        ]
      },
      {
        name: "Games PC & Console",
        slug: "games-pc",
        icon: "https://cdn-icons-png.flaticon.com/512/5727/5727284.png",
        displayOrder: 2,
        subcategories: [
          "Valorant - Contas",
          "Valorant - VP (Points)",
          "League of Legends - Contas",
          "League of Legends - RP",
          "Fortnite - V-Bucks/Skins",
          "Minecraft - Full Acesso",
          "GTA V / FiveM",
          "CS2 (Counter-Strike)",
          "Outros Jogos PC"
        ]
      },
      {
        name: "Steam & Plataformas",
        slug: "steam-plataformas",
        icon: "https://cdn-icons-png.flaticon.com/512/220/220223.png",
        displayOrder: 3,
        subcategories: [
          "Steam - Chaves (Random Keys)",
          "Steam - Jogos (Gifts)",
          "Steam - Contas",
          "Steam - Saldo/Gift Card",
          "Xbox Game Pass",
          "PlayStation Plus",
          "Epic Games",
          "Battle.net"
        ]
      },
      {
        name: "Streaming & TV",
        slug: "streaming",
        icon: "https://cdn-icons-png.flaticon.com/512/2989/2989836.png",
        displayOrder: 4,
        subcategories: [
          "Netflix - Telas/Contas",
          "YouTube Premium",
          "Disney+ / Star+",
          "Amazon Prime Video",
          "Spotify Premium",
          "HBO Max",
          "IPTV / P2P / Canais",
          "Crunchyroll"
        ]
      },
      {
        name: "Cursos & Infoprodutos",
        slug: "cursos",
        icon: "https://cdn-icons-png.flaticon.com/512/2436/2436874.png",
        displayOrder: 5,
        subcategories: [
          "Metodos de Renda Extra",
          "Cursos de Marketing Digital",
          "Cursos de Programacao",
          "Design & Edicao",
          "PLR & E-books",
          "Scripts & Bots",
          "Mentoria"
        ]
      },
      {
        name: "Softwares & Ferramentas",
        slug: "softwares",
        icon: "https://cdn-icons-png.flaticon.com/512/2282/2282194.png",
        displayOrder: 6,
        subcategories: [
          "VPN & Proxy",
          "Antivirus (Kaspersky/Avast)",
          "Windows & Office (Chaves)",
          "Canva Pro",
          "Adobe Creative Cloud",
          "Ferramentas de Automacao"
        ]
      }
    ];

    console.log("[Seed] Starting marketplace categories seed...");
    
    for (const cat of CATEGORIAS_MERCADO) {
      const existing = await storage.getCategoryBySlug(cat.slug);
      if (existing) {
        await storage.updateCategory(existing.id, { 
          name: cat.name,
          subcategories: cat.subcategories,
          displayOrder: cat.displayOrder,
          icon: cat.icon,
          active: true,
          resellerId: null
        });
        console.log(`[Seed] Updated category: ${cat.name}`);
      } else {
        await storage.createCategory({
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          subcategories: cat.subcategories,
          active: true,
          displayOrder: cat.displayOrder,
        });
        console.log(`[Seed] Created category: ${cat.name}`);
      }
    }
    
    // Deactivate old categories with legacy slugs to avoid duplicates
    const legacySlugs = ["games", "steam", "streaming-tv", "cursos-tutoriais", "outros"];
    console.log("[Seed] Deactivating legacy categories...");
    for (const slug of legacySlugs) {
      const legacyCat = await storage.getCategoryBySlug(slug);
      if (legacyCat && !legacyCat.resellerId) {
        await storage.updateCategory(legacyCat.id, { active: false });
        console.log(`[Seed] Deactivated legacy category: ${legacyCat.name}`);
      }
    }
    
    console.log("[Seed] Marketplace categories seed completed successfully");
  } catch (error: any) {
    console.error("[Seed] Error seeding marketplace categories:", error.message);
  }
}

setTimeout(() => {
  seedFixedCategories();
}, 2000);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function verifyPendingPayments() {
  try {
    // Check if ABACATEPAY_API_KEY is configured before proceeding
    if (!process.env.ABACATEPAY_API_KEY) {
      return; // Silently skip if no API key configured
    }
    
    const { storage } = await import("./storage");
    const { db } = await import("./db");
    const { orders, orderItems } = await import("../shared/schema");
    const { eq } = await import("drizzle-orm");
    const { checkPaymentStatus } = await import("./abacatePayController");
    const { sendDeliveryEmail } = await import("./email");

    const pendingOrders = await db
      .select({
        id: orders.id,
        email: orders.email,
        status: orders.status,
        abacatepayBillingId: orders.abacatepayBillingId,
        resellerId: orders.resellerId,
        totalAmount: orders.totalAmount,
      })
      .from(orders)
      .where(eq(orders.status, "pending"));

    if (pendingOrders.length === 0) {
      console.log(`[Payment Verify Cron] No pending orders to verify (${new Date().toISOString()})`);
      return;
    }

    console.log(`[Payment Verify Cron] Checking ${pendingOrders.length} pending orders...`);

    for (const order of pendingOrders) {
      try {
        if (!order.abacatepayBillingId) {
          console.log(`[Payment Verify Cron] Order ${order.id} has no billing ID, skipping`);
          continue;
        }

        const paymentStatus = await checkPaymentStatus(order.abacatepayBillingId);
        
        if (paymentStatus.isPaid) {
          console.log(`[Payment Verify Cron] ✓ Payment confirmed for order ${order.id}`);
          
          // Fetch order items to get product info
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          let deliveredContent = "";
          
          // Process each item and update deliveredContent on each orderItem
          for (const item of items) {
            const product = await storage.getProduct(item.productId);
            
            if (product && product.stock) {
              const stockLines = product.stock.split("\n").filter((line: string) => line.trim());
              
              if (stockLines.length > 0) {
                // Take first line and remove from stock
                const itemContent = stockLines[0];
                deliveredContent += itemContent + "\n";
                const remainingStock = stockLines.slice(1).join("\n");
                await storage.updateProduct(item.productId, { stock: remainingStock });
                
                // Update the order item with the delivered content
                await db.update(orderItems)
                  .set({ deliveredContent: itemContent })
                  .where(eq(orderItems.id, item.id));
                
                console.log(`[Payment Verify Cron] ✓ Delivered stock for product ${item.productId}, item ${item.id}`);
              }
            }
          }

          // Mark order as paid
          await storage.updateOrder(order.id, {
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
                const newBalance = currentBalance + valorVenda;

                await storage.updateReseller(order.resellerId, {
                  walletBalance: newBalance.toFixed(2),
                  totalSales: (parseFloat(reseller.totalSales as string || "0") + valorVenda).toFixed(2),
                  totalCommission: (parseFloat(reseller.totalCommission as string || "0") + valorVenda).toFixed(2),
                });
                console.log(`[Payment Verify Cron] ✓ Saldo revendedor atualizado: R$ ${newBalance.toFixed(2)}`);
              }
            }
          } catch (walletError: any) {
            console.error("[Payment Verify Cron] Erro ao atualizar saldo:", walletError.message);
          }

          // Send delivery email
          if (order.email && deliveredContent.trim()) {
            const productNames = items.map((i: any) => i.productName || "Produto Digital").join(", ");
            sendDeliveryEmail({
              to: order.email,
              orderId: order.id,
              productName: productNames,
              deliveredContent: deliveredContent.trim(),
              storeName: "ELITEVAULT",
            }).then(result => {
              if (result.success) {
                console.log(`[Payment Verify Cron] ✓ Email sent to ${order.email}`);
              } else {
                console.error(`[Payment Verify Cron] ❌ Email failed: ${result.error}`);
              }
            });
          }

          console.log(`[Payment Verify Cron] ✓ Order ${order.id} processed successfully`);
        }
      } catch (err) {
        console.error(`[Payment Verify Cron] Error processing order ${order.id}:`, (err as any).message);
      }
    }
  } catch (error) {
    console.error("[Payment Verify Cron] Error during payment verification:", (error as any).message);
  }
}

async function cleanupExpiredOrders() {
  try {
    const { storage } = await import("./storage");
    const { db } = await import("./db");
    const { orders } = await import("../shared/schema");
    const { eq, and, lt } = await import("drizzle-orm");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          lt(orders.createdAt, twentyFourHoursAgo)
        )
      );

    if (expiredOrders.length > 0) {
      console.log(
        `[Cleanup Cron] Found ${expiredOrders.length} expired pending orders. Deleting...`
      );

      for (const order of expiredOrders) {
        try {
          await storage.deleteOrder(order.id);
          console.log(
            `[Cleanup Cron] Deleted expired order ID: ${order.id}`
          );
        } catch (err) {
          console.error(
            `[Cleanup Cron] Failed to delete order ${order.id}:`,
            (err as any).message
          );
        }
      }

      console.log(
        `[Cleanup Cron] Cleanup complete - ${expiredOrders.length} orders deleted`
      );
    } else {
      console.log(
        `[Cleanup Cron] No expired pending orders found (checked at ${new Date().toISOString()})`
      );
    }
  } catch (error) {
    console.error("[Cleanup Cron] Error during cleanup:", (error as any).message);
  }
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      console.log(
        "[Cron] Starting payment verification for pending orders (every 60 seconds)"
      );
      setInterval(verifyPendingPayments, 60 * 1000);
      
      verifyPendingPayments().catch((err) =>
        console.error("[Cron] Initial payment verification error:", err)
      );

      console.log(
        "[Cron] Starting auto-cleanup for expired pending orders (every 60 minutes)"
      );
      setInterval(cleanupExpiredOrders, 60 * 60 * 1000);

      cleanupExpiredOrders().catch((err) =>
        console.error("[Cron] Initial cleanup error:", err)
      );

      // Clean up expired vendor sessions every hour
      console.log(
        "[Cron] Starting vendor session cleanup (every 60 minutes)"
      );
      setInterval(async () => {
        try {
          await storage.deleteExpiredVendorSessions();
          console.log("[Cron] Cleaned up expired vendor sessions");
        } catch (err: any) {
          console.error("[Cron] Vendor session cleanup error:", err.message);
        }
      }, 60 * 60 * 1000);
      
      // Initial cleanup on startup (with delay to ensure DB is ready)
      setTimeout(() => {
        storage.deleteExpiredVendorSessions().catch((err: any) =>
          console.error("[Cron] Initial vendor session cleanup error:", err.message)
        );
      }, 5000);
    },
  );
})();
