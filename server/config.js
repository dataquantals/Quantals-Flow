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

export const config = {
  root,
  publicDir: root,
  dataDir: path.join(root, 'data'),
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'app.db'),
  isTest: Boolean(process.env.DB_FILE && process.env.PORT === '0'),

  port: Number(process.env.PORT || 12000),
  host: process.env.HOST || '0.0.0.0',

  // Public origin used for same-origin checks. Set this in production.
  origin: process.env.APP_ORIGIN || null,

  session: {
    cookie: 'quantalflow_sid',
    ttlMs: 1000 * 60 * 60 * 24 * 7 // 7 days
  },

  convex: {
    cloudUrl: process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || 'https://agreeable-starfish-202.convex.cloud',
    siteUrl: process.env.CONVEX_SITE_URL || 'https://agreeable-starfish-202.convex.site',
    deployKey: process.env.CONVEX_DEPLOY_KEY || 'preview:data-quantals:quantals-flow|eyJ2MiI6IjY1OTE4MTEwYzgyMDRjMGU5MzNkZWQ1ZDUxMjRmZGZmIn0='
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

  deepseekApiKey: process.env.DEEPSEEK_API_KEY || 'sk-295f99296f8743de980675646df93fcf',

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
