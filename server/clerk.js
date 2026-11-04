import crypto from 'node:crypto';
import { config } from './config.js';

/**
 * Clerk session verification for POST /api/auth/clerk-sync.
 *
 * The browser used to post just an email address and the server minted a session
 * for it, so anyone could sign in as any account. Now the browser must send the
 * signed Clerk session JWT; we verify its signature against Clerk's published
 * keys (JWKS), check issuer/expiry, and look the email up from Clerk itself with
 * the secret key. Nothing the client says about its own identity is trusted.
 */

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache = { at: 0, keys: null, url: '' };

/** pk_test_<base64(frontendApi$)> -> frontend API host, e.g. fresh-mule-6492.clerk.accounts.dev */
export function frontendApiFromPublishableKey(key) {
  try {
    const encoded = String(key || '').split('_').slice(2).join('_');
    const host = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
    return /^[a-z0-9.-]+$/i.test(host) ? host : '';
  } catch {
    return '';
  }
}

async function loadJwks(frontendApi) {
  const url = `https://${frontendApi}/.well-known/jwks.json`;
  if (jwksCache.keys && jwksCache.url === url && Date.now() - jwksCache.at < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
  const body = await res.json();
  jwksCache = { at: Date.now(), keys: body.keys || [], url };
  return jwksCache.keys;
}

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/**
 * Verify a Clerk session JWT. Returns the claims, or throws.
 * `options.jwks` lets tests supply keys instead of fetching them.
 */
export async function verifyClerkSessionToken(token, options = {}) {
  const frontendApi = options.frontendApi || frontendApiFromPublishableKey(config.clerk.publishableKey);
  if (!frontendApi) throw new Error('Clerk is not configured.');

  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token.');

  const header = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('Unsupported token algorithm.');

  const keys = options.jwks || (await loadJwks(frontendApi));
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key.');

  const ok = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    Buffer.from(parts[2], 'base64url')
  );
  if (!ok) throw new Error('Invalid token signature.');

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) throw new Error('Token expired.');
  if (typeof claims.nbf === 'number' && claims.nbf > now + 5) throw new Error('Token not yet valid.');
  if (claims.iss !== `https://${frontendApi}`) throw new Error('Unexpected token issuer.');
  if (!claims.sub) throw new Error('Token has no subject.');
  return claims;
}

/** The Clerk user's verified primary email, fetched from Clerk with the secret key. */
export async function fetchClerkIdentity(clerkUserId) {
  if (!config.clerk.secretKey) throw new Error('CLERK_SECRET_KEY is not set.');
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, {
    headers: { Authorization: `Bearer ${config.clerk.secretKey}` },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`Clerk user lookup failed (${res.status})`);
  const user = await res.json();
  const emails = Array.isArray(user.email_addresses) ? user.email_addresses : [];
  const primary = emails.find((e) => e.id === user.primary_email_address_id) || emails[0];
  if (!primary || !primary.email_address) throw new Error('Clerk user has no email.');
  if (primary.verification && primary.verification.status !== 'verified') {
    throw new Error('Clerk email is not verified.');
  }
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return { email: String(primary.email_address).trim().toLowerCase(), name };
}
