import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[DB] CRITICAL: DATABASE_URL is not set!");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("[DB] Initializing database connection...");

const poolConfig = {
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

pool.on('connect', () => {
  console.log('[DB] New client connected to pool');
});

async function testConnection(retries = 3, delay = 2000): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log(`[DB] Connection test successful (attempt ${attempt}/${retries})`);
      return true;
    } catch (error: any) {
      console.error(`[DB] Connection test failed (attempt ${attempt}/${retries}):`, error.message);
      if (attempt < retries) {
        console.log(`[DB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('[DB] All connection attempts failed');
  return false;
}

testConnection().then(success => {
  if (success) {
    console.log('[DB] Database ready for queries');
  } else {
    console.error('[DB] WARNING: Could not establish initial connection');
  }
});

export const db = drizzle({ client: pool, schema });
