#!/usr/bin/env node
/**
 * Redis Cloud Verification Script (`npm run redis:verify`)
 *
 * Verifies:
 *  1. REDIS_URL connection & PING latency
 *  2. Cache-aside JSON set/get/del with TTL
 *  3. Redis OM JSON document save + RediSearch index creation + full-text query
 *  4. Clean teardown of all temporary test keys
 */
import { checkRedisConnection, cacheSet, cacheGet, cacheDel, getRedisClient } from '../server/redis.js';
import { indexBoardInRedis, searchBoardsInRedis, removeBoardFromRedis } from '../server/redis-om.js';

async function main() {
  console.log('1. Checking Redis Cloud connection...');
  const status = await checkRedisConnection();
  if (!status.configured) {
    console.error('ERROR: REDIS_URL is not set. Add REDIS_URL to miro-clone/miro-clone/.env.local and re-run.');
    process.exit(1);
  }
  if (!status.connected) {
    console.error('ERROR: Could not connect to Redis Cloud:', status.error);
    process.exit(1);
  }
  console.log(`   Connected! PING latency: ${status.latencyMs}ms`);

  console.log('2. Testing Cache-Aside (JSON + TTL)...');
  const testCacheKey = `verify:${Date.now()}`;
  await cacheSet(testCacheKey, { ok: true, ts: Date.now() }, 30);
  const hit = await cacheGet(testCacheKey);
  if (!hit || !hit.ok) throw new Error('Cache-aside roundtrip failed');
  await cacheDel(testCacheKey);
  console.log('   Cache-aside set/get/del OK.');

  console.log('3. Testing Redis OM JSON + RediSearch...');
  const testUserId = 'verify-user';
  const testBoardId = `verify-board-${Date.now()}`;
  const indexed = await indexBoardInRedis(testUserId, {
    id: testBoardId,
    title: 'QuantalFlow Redis Cloud Search Verification',
    category: 'Architecture',
    starred: true,
    updatedAt: Date.now()
  }, 60);
  if (!indexed) throw new Error('Redis OM save failed (ensure your Redis Cloud database has RedisJSON + RediSearch enabled)');

  const results = await searchBoardsInRedis(testUserId, 'Verification', true);
  const found = Array.isArray(results) && results.some((r) => r.id === testBoardId);
  await removeBoardFromRedis(testUserId, testBoardId);
  if (!found) throw new Error('RediSearch query did not return the indexed board');
  console.log(`   Redis OM + RediSearch OK (matched ${results.length} doc).`);

  const client = await getRedisClient();
  if (client && client.isOpen) await client.quit();
  console.log('\nAll Redis Cloud checks passed!');
}

main().catch((err) => {
  console.error('\nRedis verification failed:', err.message);
  process.exit(1);
});
