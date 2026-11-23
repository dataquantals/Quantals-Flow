/* ==========================================================================
   QuantalFlow Multi-Agent AI Router with Live Free-Model Discovery & Failover
   ==========================================================================
   Routes AI requests across configured agents (DeepSeek, OpenRouter Live Free
   Models Pool, and future providers).
   - Discovers live `:free` models from OpenRouter's catalog (cached 60 mins)
     so retired slugs never waste round-trips with 404s.
   - Automatically cools down depleted (402), rate-limited (429), or broken
     models and immediately jumps to the next best healthy agent & model.
   ========================================================================== */
import { config } from './config.js';

const FALLBACK_OPENROUTER_MODELS = ['openrouter/free'];

// In-memory health tracker keyed by "<provider>:<model>"
const healthMap = new Map();

// Cached live free models from OpenRouter API
let cachedOpenRouterModels = null;
let cachedOpenRouterAt = 0;
const CATALOG_TTL_MS = 60 * 60 * 1000;

function markCooldown(key, reason, ms, hard = false) {
  healthMap.set(key, {
    cooldownUntil: Date.now() + ms,
    lastReason: reason,
    hard,
    lastFailureAt: Date.now()
  });
}

function markHealthy(key) {
  healthMap.set(key, {
    cooldownUntil: 0,
    lastReason: null,
    hard: false,
    lastSuccessAt: Date.now()
  });
}

function getHealth(key) {
  return healthMap.get(key) || { cooldownUntil: 0, lastReason: null, hard: false };
}

function isCoolingDown(key) {
  const entry = healthMap.get(key);
  if (!entry || !entry.cooldownUntil) return false;
  return Date.now() < entry.cooldownUntil;
}

/** Discover currently active free chat models on OpenRouter (cached 1h). */
async function discoverOpenRouterFreeModels() {
  if (config.openrouterModels && config.openrouterModels.length) {
    return config.openrouterModels;
  }
  if (cachedOpenRouterModels && (Date.now() - cachedOpenRouterAt) < CATALOG_TTL_MS) {
    return cachedOpenRouterModels;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${config.openrouterApiKey}` },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const rows = Array.isArray(json.data) ? json.data : [];
      const freeModels = rows
        .filter((m) => {
          const id = String(m.id || '');
          const p = m.pricing || {};
          const isZero = (String(p.prompt) === '0' && String(p.completion) === '0') || id.endsWith(':free');
          const notVisionOnly = !/vision|image|audio|whisper|embed/i.test(id);
          return id && isZero && notVisionOnly;
        })
        .sort((a, b) => {
          const rank = (id) => {
            if (/deepseek|llama-3\.3|qwen.*72b|gemma-3-27b/i.test(id)) return 3;
            if (/llama|qwen|mistral|gemini|gemma/i.test(id)) return 2;
            return 1;
          };
          const diff = rank(b.id) - rank(a.id);
          if (diff !== 0) return diff;
          return (Number(b.context_length) || 0) - (Number(a.context_length) || 0);
        })
        .map((m) => m.id)
        .slice(0, 6);

      // Always put openrouter/free first (guaranteed live auto-router) followed by top discovered free models
      cachedOpenRouterModels = Array.from(new Set(['openrouter/free', ...freeModels]));
      cachedOpenRouterAt = Date.now();
      return cachedOpenRouterModels;
    }
  } catch {
    // Fall back to openrouter/free if catalog fetch times out
  }

  return FALLBACK_OPENROUTER_MODELS;
}

async function buildCandidates() {
  const list = [];

  if (config.deepseekApiKey) {
    list.push({
      provider: 'deepseek',
      model: 'deepseek-chat',
      url: 'https://api.deepseek.com/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.deepseekApiKey}`
      }
    });
  }

  if (config.openrouterApiKey) {
    const models = await discoverOpenRouterFreeModels();
    for (const model of models) {
      list.push({
        provider: 'openrouter',
        model,
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': config.origin || 'http://localhost:12000',
          'X-Title': 'QuantalFlow'
        }
      });
    }
  }

  const healthy = [];
  const softCooling = [];
  for (const c of list) {
    const key = `${c.provider}:${c.model}`;
    const h = getHealth(key);
    if (!isCoolingDown(key)) {
      healthy.push(c);
    } else if (!h.hard) {
      // Soft cooldown (429/5xx) can be retried as last resort; hard cooldown (402/404) is skipped
      softCooling.push(c);
    }
  }
  return healthy.length ? healthy : softCooling;
}

export function hasAnyAiProvider() {
  return Boolean(config.deepseekApiKey || config.openrouterApiKey);
}

export function getAiRouterStatus() {
  const models = cachedOpenRouterModels || FALLBACK_OPENROUTER_MODELS;
  const agents = [];
  if (config.deepseekApiKey) {
    const key = 'deepseek:deepseek-chat';
    const h = getHealth(key);
    const cooling = isCoolingDown(key);
    agents.push({
      provider: 'deepseek',
      model: 'deepseek-chat',
      status: cooling ? 'cooldown' : 'ready',
      cooldownSecondsRemaining: cooling ? Math.ceil((h.cooldownUntil - Date.now()) / 1000) : 0,
      lastReason: h.lastReason || null
    });
  }
  if (config.openrouterApiKey) {
    for (const model of models) {
      const key = `openrouter:${model}`;
      const h = getHealth(key);
      const cooling = isCoolingDown(key);
      agents.push({
        provider: 'openrouter',
        model,
        status: cooling ? 'cooldown' : 'ready',
        cooldownSecondsRemaining: cooling ? Math.ceil((h.cooldownUntil - Date.now()) / 1000) : 0,
        lastReason: h.lastReason || null
      });
    }
  }
  return {
    configured: agents.length > 0,
    providers: {
      deepseek: Boolean(config.deepseekApiKey),
      openrouter: Boolean(config.openrouterApiKey)
    },
    agents
  };
}

/**
 * Execute an AI chat completion across the multi-agent pool with automatic
 * failover on quota exhaustion (402), rate limits (429), or transient errors.
 */
export async function callAiRouter({ systemPrompt, userContent, temperature = 0.6, maxTokens = 1600, timeoutMs = 28000 }) {
  const candidates = await buildCandidates();
  if (!candidates.length) return null;

  const attempts = [];

  for (const cand of candidates) {
    const key = `${cand.provider}:${cand.model}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(cand.url, {
        method: 'POST',
        headers: cand.headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: cand.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          temperature,
          max_tokens: maxTokens
        })
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const status = response.status;
        attempts.push({ provider: cand.provider, model: cand.model, status });

        if (status === 402 || /insufficient|quota|balance|credit/i.test(errText)) {
          markCooldown(key, `Quota depleted (${status})`, 30 * 60 * 1000, true);
          console.warn(`[ai-router] ${key} depleted (${status}); jumping to next agent.`);
        } else if (status === 429) {
          markCooldown(key, 'Rate limited (429)', 5 * 60 * 1000, false);
          console.warn(`[ai-router] ${key} rate limited (429); jumping to next model.`);
        } else if (status === 404 || status === 400) {
          markCooldown(key, `Unavailable (${status})`, 60 * 60 * 1000, true);
          console.warn(`[ai-router] ${key} unavailable (${status}); skipping.`);
        } else {
          markCooldown(key, `HTTP ${status}`, 2 * 60 * 1000, false);
          console.warn(`[ai-router] ${key} failed (${status}); failing over.`);
        }
        continue;
      }

      const data = await response.json();
      const content = String(data.choices?.[0]?.message?.content || '').trim();
      const resolvedModel = String(data.model || cand.model);
      if (!content) {
        attempts.push({ provider: cand.provider, model: cand.model, status: 'empty' });
        markCooldown(key, 'Empty response', 2 * 60 * 1000, false);
        continue;
      }

      markHealthy(key);
      const shortModel = resolvedModel.split('/').pop().replace(/:free$/, '');
      console.log(`[ai-router] served by ${cand.provider}:${resolvedModel}`);
      return {
        content,
        provider: cand.provider,
        model: resolvedModel,
        label: `${cand.provider === 'openrouter' ? 'OpenRouter' : 'DeepSeek'} (${shortModel})`,
        attempts
      };
    } catch (err) {
      clearTimeout(timer);
      attempts.push({ provider: cand.provider, model: cand.model, error: err.message });
      markCooldown(key, err.name === 'AbortError' ? 'Timeout' : err.message, 2 * 60 * 1000, false);
      console.warn(`[ai-router] ${key} error (${err.message}); failing over.`);
    }
  }

  return null;
}
