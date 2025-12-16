import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    const issuerUrl = process.env.ISSUER_URL || "https://replit.com/oidc";
    return await client.discovery(
      new URL(issuerUrl),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;
  const sessionStore = new pgStore({
    conString: databaseUrl,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  const userId = claims["sub"];
  const email = claims["email"];
  const firstName = claims["first_name"];
  const lastName = claims["last_name"];
  
  // Check if this is a new customer (doesn't exist yet)
  const existingUser = await storage.getCustomerUser(userId);
  const isNewCustomer = !existingUser;
  
  await storage.upsertCustomerUser({
    id: userId,
    email: email,
    firstName: firstName,
    lastName: lastName,
    profileImageUrl: claims["profile_image_url"],
  });
  
  // Send Discord notification for new customer registration
  if (isNewCustomer && email) {
    try {
      const { discordService } = await import('./discord-service');
      const fs = await import('fs');
      const path = await import('path');
      
      // Read admin settings to check if notifications are enabled
      const settingsPath = path.join(process.cwd(), 'settings.json');
      let settings: any = {};
      try {
        if (fs.existsSync(settingsPath)) {
          settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        }
      } catch (e) {
        console.log('[Auth] Could not read settings:', e);
      }
      
      if (settings.adminDiscordNewCustomerEnabled !== false && discordService.isAdminReady()) {
        const customerName = [firstName, lastName].filter(Boolean).join(' ') || 'Cliente';
        
        await discordService.sendAdminMessage('', [{
          title: 'Novo Cadastro!',
          color: 0x5865f2,
          fields: [
            { name: 'Cliente', value: customerName, inline: true },
            { name: 'Email', value: email, inline: true },
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'GOLDNET Marketplace' }
        }]);
        
        console.log('[Auth] New customer registration notification sent for:', email);
      }
    } catch (err) {
      console.error('[Auth] Failed to send new customer notification:', err);
    }
  }
}

export async function setupAuth(app: Express) {
  if (!process.env.REPL_ID) {
    console.log("[Auth] REPL_ID not found - Replit Auth disabled (running outside Replit)");
    return;
  }

  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    let returnTo = req.query.returnTo as string || "/";
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
      returnTo = "/";
    }
    (req.session as any).returnTo = returnTo;
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    let returnTo = (req.session as any).returnTo || "/";
    if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
      returnTo = "/";
    }
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: returnTo,
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!process.env.REPL_ID) {
    return res.status(401).json({ message: "Authentication not available outside Replit" });
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
