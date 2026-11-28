import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env.local / .env automatically using Node 22 built-in process.loadEnvFile
for (const envName of ['.env.local', '.env']) {
  const envPath = path.join(root, envName);
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* ignore malformed env file */
    }
  }
}

const rawConvexDeployment = (process.env.CONVEX_DEPLOYMENT || 'dev:agreeable-starfish-202').trim();
const deploymentSlugMatch = rawConvexDeployment.match(/^(?:dev|prod|preview):([a-z0-9-]+)$/i);
const derivedConvexSlug = deploymentSlugMatch ? deploymentSlugMatch[1] : 'agreeable-starfish-202';

export const config = {
  root,
  publicDir: root,
  dataDir: process.env.VERCEL ? '/tmp/data' : path.join(root, 'data'),
  dbFile: process.env.DB_FILE || (process.env.VERCEL ? '/tmp/data/app.db' : path.join(root, 'data', 'app.db')),
  isTest: Boolean(process.env.DB_FILE && process.env.PORT === '0'),

  port: Number(process.env.PORT || 12000),
  host: process.env.HOST || '0.0.0.0',

  // Public origin used for same-origin checks. Set this in production.
  origin: process.env.APP_ORIGIN || null,

  session: {
    cookie: 'quantalflow_sid',
    ttlMs: 1000 * 60 * 60 * 24 * 7, // 7 days
    // Key for the HMAC that signs the session cookie. A signed cookie keeps a
    // session valid across serverless instances (each one gets its own /tmp
    // SQLite file), so this must be the same value on every instance.
    secret:
      process.env.SESSION_SECRET ||
      process.env.SYNC_SECRET ||
      'quantalflow-dev-session-secret-change-me'
  },

  convex: {
    deployment: rawConvexDeployment,
    cloudUrl:
      process.env.CONVEX_URL ||
      process.env.NEXT_PUBLIC_CONVEX_URL ||
      `https://${derivedConvexSlug}.convex.cloud`,
    siteUrl:
      process.env.CONVEX_SITE_URL ||
      `https://${derivedConvexSlug}.convex.site`,
    deployKey: process.env.CONVEX_DEPLOY_KEY || '',
    // Shared secret proving a caller is this server. The same value must be set on
    // the Convex deployment (`npx convex env set SYNC_SECRET <value>`); every Convex
    // function rejects calls that do not present it.
    syncSecret: process.env.SYNC_SECRET || '5a37ef7dd1a6cc08602bc1a6bb68f7e6045627efe7dd9caf110045c93ba81b0b'
  },

  redis: {
    // Remote Redis Cloud connection string (redis:// or rediss://).
    // Leave unset to keep Redis disabled without impacting SQLite/Convex.
    url: (process.env.REDIS_URL || '').trim(),
    defaultTtlSeconds: Math.max(15, Number(process.env.REDIS_CACHE_TTL || 120)),
    keyPrefix: (process.env.REDIS_KEY_PREFIX || 'qf').trim()
  },

  clerk: {
    appId: process.env.CLERK_APP_ID || 'app_3J61UxGk74wsSiFkJfzJwBqbNUn',
    publishableKey:
      process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.VITE_CLERK_PUBLISHABLE_KEY ||
      '',
    secretKey: process.env.CLERK_SECRET_KEY || ''
  },

  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModels: process.env.OPENROUTER_MODELS
    ? process.env.OPENROUTER_MODELS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],

  cloudinary: {
    url:
      process.env.CLOUDINARY_URL ||
      'cloudinary://764744472548129:QdPcOpYAS5_KDHWJNLCPYdtPvXM@dbay0ozoo',
    folder: process.env.CLOUDINARY_FOLDER || 'circuit-overseers-visit'
  },

  // Failed sign-in attempts allowed per IP before a temporary lockout.
  rateLimit: {
    windowMs: 1000 * 60 * 10,
    maxAttempts: 10
  },

  seed: {
    email: process.env.SEED_EMAIL || 'dataquantals@gmail.com',
    password: process.env.SEED_PASSWORD || '123456',
    name: process.env.SEED_NAME || 'Owner',
    role: 'owner'
  },

  isProduction: process.env.NODE_ENV === 'production'
};

// Say so once at boot instead of failing silently on the first AI or Convex call.
if (!config.isTest) {
  if (!config.convex.cloudUrl || !config.convex.syncSecret) {
    console.warn('[config] CONVEX_URL or SYNC_SECRET is not set — Convex sync stays disabled.');
  }
  if (!config.redis.url) {
    console.warn('[config] REDIS_URL is not set — optional Redis cache stays disabled (SQLite + Convex active).');
  }
  if (!config.clerk.publishableKey || !config.clerk.secretKey) {
    console.warn('[config] CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY is not set — Google / SSO sign-in stays disabled.');
  }
  if (!config.deepseekApiKey && !config.openrouterApiKey) {
    console.warn('[config] Neither DEEPSEEK_API_KEY nor OPENROUTER_API_KEY is set — AI copilot stays disabled.');
  }
}
