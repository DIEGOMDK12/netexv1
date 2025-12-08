import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

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

// Custom Domain Routing Middleware (White Label)
// This MUST run before all other routes
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host?.toLowerCase().replace(/:\d+$/, "") || "";
  
  // Skip for main domain and localhost variants
  const mainDomains = [
    "goldnetsteam.shop",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ];
  
  const isMainDomain = mainDomains.some((d) => host === d || host.endsWith(`.replit.dev`) || host.endsWith(`.repl.co`));
  
  if (isMainDomain) {
    return next();
  }
  
  // Skip for static assets (don't rewrite these paths)
  const staticPaths = [
    "/api",
    "/loja/",
    "/uploads",
    "/assets",
    "/favicon.ico",
    "/favicon.png",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.json",
    "/.well-known",
    "/sw.js",
    "/workbox-",
  ];
  
  if (staticPaths.some((p) => req.path.startsWith(p) || req.path === p.replace(/\/$/, ""))) {
    return next();
  }
  
  // This is a custom domain - look up the reseller
  try {
    // Skip if host looks invalid (contains spaces, SQL, or shell commands)
    if (!host || host.includes(" ") || host.includes(";") || host.includes("$") || host.length > 253) {
      console.log(`[Custom Domain] Invalid host format, skipping: ${host.substring(0, 50)}`);
      return next();
    }
    
    const { storage } = await import("./storage");
    const reseller = await storage.getResellerByDomain(host);
    
    if (reseller) {
      console.log(`[Custom Domain] ${host} -> Reseller: ${reseller.slug} (ID: ${reseller.id})`);
      
      // Inject reseller info into request for downstream use
      (req as any).customDomainReseller = reseller;
      
      // Preserve query string when rewriting
      const queryString = req.originalUrl.includes("?") 
        ? "?" + req.originalUrl.split("?")[1] 
        : "";
      
      // Rewrite URL to serve the reseller's store
      if (req.path === "/" || req.path === "") {
        req.url = `/loja/${reseller.slug}${queryString}`;
        console.log(`[Custom Domain] Rewriting / to ${req.url}`);
      } else {
        // For other frontend paths (like /produto/), prepend with reseller's loja path
        const originalPath = req.path;
        req.url = `/loja/${reseller.slug}${originalPath}${queryString}`;
        console.log(`[Custom Domain] Rewriting ${originalPath} to ${req.url}`);
      }
    } else {
      console.log(`[Custom Domain] No reseller found for domain: ${host}`);
    }
  } catch (error) {
    console.error("[Custom Domain] Error looking up domain:", (error as any).message || error);
  }
  
  next();
});

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
