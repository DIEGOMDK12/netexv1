import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db";

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
    
    client.release();
    console.log("[Migration] Startup migrations completed successfully");
  } catch (error: any) {
    console.error("[Migration] Error running startup migrations:", error.message);
  }
}

runStartupMigrations();

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
          
          // Process each item
          for (const item of items) {
            const product = await storage.getProduct(item.productId);
            
            if (product && product.stock) {
              const stockLines = product.stock.split("\n").filter((line: string) => line.trim());
              
              if (stockLines.length > 0) {
                // Take first line and remove from stock
                deliveredContent += stockLines[0] + "\n";
                const remainingStock = stockLines.slice(1).join("\n");
                await storage.updateProduct(item.productId, { stock: remainingStock });
                console.log(`[Payment Verify Cron] ✓ Delivered stock for product ${item.productId}`);
              }
            }
          }

          // Mark order as paid
          await storage.updateOrder(order.id, {
            status: "paid",
            deliveredContent: deliveredContent.trim(),
          });

          // Send delivery email
          if (order.email && deliveredContent.trim()) {
            const productNames = items.map((i: any) => i.productName || "Produto Digital").join(", ");
            sendDeliveryEmail({
              to: order.email,
              orderId: order.id,
              productName: productNames,
              deliveredContent: deliveredContent.trim(),
              storeName: "NexStore",
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
    },
  );
})();
