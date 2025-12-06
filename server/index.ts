import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getStripeClient } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import Stripe from 'stripe';

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function initStripe() {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      console.log('[Stripe] No STRIPE_SECRET_KEY - skipping Stripe initialization');
      return false;
    }
    
    console.log('[Stripe] Initializing with standard Stripe SDK...');
    getStripeClient();
    console.log('[Stripe] Client initialized successfully');
    return true;
  } catch (error) {
    console.error('[Stripe] Failed to initialize:', error);
    return false;
  }
}

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('[Stripe Webhook] req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const event = await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      
      console.log('[Stripe Webhook] Event type:', event.type);

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          await WebhookHandlers.handleCheckoutSessionCompleted(session);
          break;
        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Stripe Webhook] Error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

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

async function cleanupExpiredOrders() {
  try {
    const { storage } = await import("./storage");
    const { db } = await import("./db");
    const { orders } = await import("../shared/schema");
    const { sql } = await import("drizzle-orm");
    const { eq, and, lt } = await import("drizzle-orm");

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expiredOrders = await db
      .select()
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
  initStripe();
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
        "[Cron] Starting auto-cleanup for expired pending orders (every 60 minutes)"
      );
      setInterval(cleanupExpiredOrders, 60 * 60 * 1000);

      cleanupExpiredOrders().catch((err) =>
        console.error("[Cron] Initial cleanup error:", err)
      );
    },
  );
})();
