import { ConvexError } from 'convex/values';

/**
 * Access control for every public Convex function.
 *
 * Why this is not `ctx.auth.getUserIdentity()`: the browser never talks to
 * Convex. Only the QuantalFlow Node server does, and its sessions are its own
 * HttpOnly cookies, not Convex JWTs, so `getUserIdentity()` is always null here.
 *
 * Instead the Node server authenticates the browser (cookie -> SQLite session)
 * and then calls Convex with two things:
 *   - `secret`: a shared secret only the server holds (CONVEX env SYNC_SECRET),
 *               proving the caller is the trusted server, not a stranger who
 *               found the deployment URL; and
 *   - `userId`: the session user's id, which the server derives itself and never
 *               copies from client input.
 *
 * Without the secret every function fails closed, so the deployment is no longer
 * readable or writable by the public.
 */

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Throws unless the caller presented the server-only shared secret. */
export function assertServer(secret: string | undefined): void {
  const expected = process.env.SYNC_SECRET;
  if (!expected) throw new ConvexError('Server misconfigured: SYNC_SECRET is not set');
  if (!secret || !safeEqual(secret, expected)) throw new ConvexError('Unauthenticated request');
}

/**
 * Verify the caller is the trusted server and return the acting user's id.
 * Call this first in every query and mutation that touches user-owned data.
 */
export function requireUser(args: { secret?: string; userId?: string }): string {
  assertServer(args.secret);
  const userId = (args.userId ?? '').trim();
  if (!userId) throw new ConvexError('Unauthenticated request');
  return userId;
}

/** True when `row` belongs to `userId`. Rows with no owner belong to nobody. */
export function owns(row: { userId?: string | null } | null | undefined, userId: string): boolean {
  return Boolean(row && row.userId && row.userId === userId);
}

/** Throws a Forbidden error unless `row` belongs to `userId`. */
export function assertOwner(
  row: { userId?: string | null } | null | undefined,
  userId: string
): void {
  if (!owns(row, userId)) throw new ConvexError('Forbidden');
}
