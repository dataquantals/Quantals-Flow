import { createClient } from 'redis';
import { config } from './config.js';

/**
 * Reusable Redis Cloud Singleton Client (`server/redis.js`)
 *
 * - Connects strictly via `process.env.REDIS_URL` (Redis Cloud `redis://` or `rediss://`).
 * - Stored on `globalThis.__qfRedis` so hot-reloads (`node --watch`) and warm
 *   Vercel serverless invocations reuse the existing TCP/TLS connection.
 * - Fails open: if `REDIS_URL` is unset or Redis Cloud is temporarily unreachable,
 *   all helpers return `null`/`false` so SQLite + Convex continue serving normally.
 */

const GLOBAL_KEY = '__qfRedis';

function getState() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = {
      client: null,
      connecting: null,
      lastError: null,
      cooldownUntil: 0
    };
  }
  return globalThis[GLOBAL_KEY];
}

export function isRedisConfigured() {
  return Boolean(config.redis && config.redis.url && !config.isTest);
}

/**
 * Returns a connected `node-redis` client, or `null` if unconfigured / unavailable.
 */
export async function getRedisClient() {
  if (!isRedisConfigured()) return null;
  const state = getState();

  if (state.client && state.client.isReady) {
    return state.client;
  }

  // Short circuit during brief cooldown after a connection failure so API routes never stall
  if (Date.now() < state.cooldownUntil) {
    return null;
  }

  if (state.connecting) {
    return await state.connecting;
  }

  state.connecting = (async () => {
    try {
      const url = config.redis.url;
      const isTls = url.startsWith('rediss://');
      const client = createClient({
        url,
        socket: {
          connectTimeout: 10000,
          tls: isTls ? true : undefined,
          reconnectStrategy: (retries) => {
            if (retries > 5) return new Error('Redis Cloud reconnect limit reached');
            return Math.min(retries * 200, 1500);
          }
        }
      });

      client.on('error', (err) => {
        state.lastError = err ? err.message : 'Unknown Redis error';
        if (!state._loggedError) {
          console.warn('[redis] connection warning:', state.lastError);
          state._loggedError = true;
        }
      });

      client.on('ready', () => {
        state.lastError = null;
        state._loggedError = false;
      });

      await client.connect();
      state.client = client;
      state.cooldownUntil = 0;
      return client;
    } catch (err) {
      state.lastError = err ? err.message : 'Failed to connect to Redis Cloud';
      state.cooldownUntil = Date.now() + 15000;
      console.warn('[redis] connect failed (falling back to primary DB):', state.lastError);
      return null;
    } finally {
      state.connecting = null;
    }
  })();

  return await state.connecting;
}

/* ------------------------------------------------------------------ *
 * Cache-Aside Helpers (with automatic JSON serialization & TTLs)
 * ------------------------------------------------------------------ */

function namespaced(key) {
  const prefix = (config.redis && config.redis.keyPrefix) || 'qf';
  return `${prefix}:cache:${key}`;
}

export async function cacheGet(key) {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(namespaced(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  const client = await getRedisClient();
  if (!client) return false;
  const ttl = Math.max(10, Number(ttlSeconds || (config.redis && config.redis.defaultTtlSeconds) || 120));
  try {
    await client.set(namespaced(key), JSON.stringify(value), { EX: ttl });
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(key) {
  const client = await getRedisClient();
  if (!client) return false;
  try {
    await client.del(namespaced(key));
    return true;
  } catch {
    return false;
  }
}

export async function checkRedisConnection() {
  const state = getState();
  const info = {
    configured: isRedisConfigured(),
    connected: false,
    latencyMs: null,
    error: state.lastError || null
  };
  if (!info.configured) return info;

  const t0 = Date.now();
  const client = await getRedisClient();
  if (!client) {
    info.error = state.lastError || 'Unable to connect to Redis Cloud';
    return info;
  }
  try {
    const pong = await client.ping();
    info.connected = pong === 'PONG';
    info.latencyMs = Date.now() - t0;
    info.error = null;
  } catch (err) {
    info.connected = false;
    info.error = err ? err.message : 'PING failed';
  }
  return info;
}
