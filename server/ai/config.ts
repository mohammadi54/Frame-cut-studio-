/**
 * Environment driven configuration for the AI failover layer.
 *
 * Design rules:
 *  - Gemini is always the primary provider; nothing reorders it.
 *  - Every alternate provider is opt-in through its API key. No key -> the
 *    provider is reported as `configured: false` and skipped without cost.
 *  - All tuning knobs have safe defaults so the app behaves sensibly with only
 *    GEMINI_API_KEY set (the current .env.example contract).
 */

export interface ModelTargetConfig {
  provider: string;
  model: string;
  /** First target in the whole chain == the primary one. */
  primary?: boolean;
}

export interface ProviderConfig {
  id: string;
  label: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
  /** Can this provider accept inline audio? (Gemini + opt-in OpenAI audio) */
  supportsAudio: boolean;
  enabled: boolean;
}

export interface AiConfig {
  gemini: ProviderConfig;
  alternates: ProviderConfig[];
  /** Every known provider config, including unconfigured ones (status reporting). */
  allProviders: Record<string, ProviderConfig>;
  /** Ordered provider ids used when Gemini cannot serve a request. */
  failoverOrder: string[];
  retry: {
    maxRetriesPerTarget: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
  };
  timeouts: {
    textMs: number;
    audioMs: number;
    totalBudgetTextMs: number;
    totalBudgetAudioMs: number;
  };
  cooldown: {
    enabled: boolean;
    threshold: number;
    durationMs: number;
  };
  /** Escape hatch: true = legacy behaviour (single Gemini model, no failover). */
  failoverDisabled: boolean;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
/** Cheaper/older Gemini models still served by the API, in preference order. */
const DEFAULT_GEMINI_FALLBACKS = ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];

export const DEFAULT_FALLBACK_ORDER = ['openrouter', 'groq', 'openai', 'anthropic'];

function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = env(name).toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(env(name), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = env(name);
  if (!raw) return [...fallback];
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [...fallback];
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

/** Strip a trailing slash so `${baseUrl}/chat/completions` is always valid. */
function normaliseBase(url: string, fallback: string): string {
  const value = (url || fallback).replace(/\/+$/, '');
  return value || fallback;
}

export function loadAiConfig(fromEnv: NodeJS.ProcessEnv = process.env): AiConfig {
  const read = (name: string) => {
    const value = fromEnv[name];
    return typeof value === 'string' ? value.trim() : '';
  };

  // --- Gemini (primary) -------------------------------------------------
  const geminiModels = dedupe([
    read('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL,
    ...listFromEnvNames(fromEnv, 'GEMINI_FALLBACK_MODELS', DEFAULT_GEMINI_FALLBACKS),
  ]);
  const gemini: ProviderConfig = {
    id: 'gemini',
    label: 'Google Gemini (primary)',
    apiKey: read('GEMINI_API_KEY'),
    baseUrl: normaliseBase(read('GEMINI_BASE_URL'), 'https://generativelanguage.googleapis.com'),
    models: geminiModels,
    supportsAudio: true,
    enabled: Boolean(read('GEMINI_API_KEY')),
  };

  // --- OpenAI-compatible alternates -------------------------------------
  const openrouter: ProviderConfig = {
    id: 'openrouter',
    label: 'OpenRouter',
    apiKey: read('OPENROUTER_API_KEY'),
    baseUrl: normaliseBase(read('OPENROUTER_BASE_URL'), 'https://openrouter.ai/api/v1'),
    models: dedupe(listFromEnvNames(fromEnv, 'OPENROUTER_MODELS', ['openai/gpt-4o-mini'])),
    supportsAudio: false,
    enabled: Boolean(read('OPENROUTER_API_KEY')),
  };

  const groq: ProviderConfig = {
    id: 'groq',
    label: 'Groq',
    apiKey: read('GROQ_API_KEY'),
    baseUrl: normaliseBase(read('GROQ_BASE_URL'), 'https://api.groq.com/openai/v1'),
    models: dedupe(listFromEnvNames(fromEnv, 'GROQ_MODELS', ['llama-3.3-70b-versatile'])),
    supportsAudio: false,
    enabled: Boolean(read('GROQ_API_KEY')),
  };

  const openaiAudioModel = read('OPENAI_AUDIO_MODEL');
  const openai: ProviderConfig = {
    id: 'openai',
    label: 'OpenAI',
    apiKey: read('OPENAI_API_KEY'),
    baseUrl: normaliseBase(read('OPENAI_BASE_URL'), 'https://api.openai.com/v1'),
    models: dedupe(listFromEnvNames(fromEnv, 'OPENAI_MODELS', ['gpt-4o-mini'])),
    // Audio only when explicitly configured, since most OpenAI chat models
    // reject inline audio and the request would be wasted.
    supportsAudio: Boolean(openaiAudioModel),
    enabled: Boolean(read('OPENAI_API_KEY')),
  };

  const anthropic: ProviderConfig = {
    id: 'anthropic',
    label: 'Anthropic',
    apiKey: read('ANTHROPIC_API_KEY'),
    baseUrl: normaliseBase(read('ANTHROPIC_BASE_URL'), 'https://api.anthropic.com'),
    models: dedupe(listFromEnvNames(fromEnv, 'ANTHROPIC_MODELS', ['claude-3-5-haiku-latest'])),
    supportsAudio: false,
    enabled: Boolean(read('ANTHROPIC_API_KEY')),
  };

  const byId: Record<string, ProviderConfig> = { gemini, openrouter, groq, openai, anthropic };

  const failoverOrder = dedupe(
    listFromEnvNames(fromEnv, 'AI_FALLBACK_PROVIDER_ORDER', DEFAULT_FALLBACK_ORDER)
  ).filter((id) => id !== 'gemini' && Boolean(byId[id]));

  const failoverDisabled = envBoolFrom(fromEnv, 'DISABLE_AI_FAILOVER', false);

  return {
    gemini,
    alternates: failoverOrder.map((id) => byId[id]),
    allProviders: byId,
    failoverOrder,
    retry: {
      maxRetriesPerTarget: intFrom(fromEnv, 'AI_MAX_RETRIES_PER_TARGET', 1),
      baseDelayMs: intFrom(fromEnv, 'AI_RETRY_BASE_MS', 400),
      maxDelayMs: intFrom(fromEnv, 'AI_RETRY_MAX_MS', 4000),
      jitter: envBoolFrom(fromEnv, 'AI_RETRY_JITTER', true),
    },
    timeouts: {
      textMs: intFrom(fromEnv, 'AI_REQUEST_TIMEOUT_MS', 45_000),
      audioMs: intFrom(fromEnv, 'AI_AUDIO_TIMEOUT_MS', 120_000),
      totalBudgetTextMs: intFrom(fromEnv, 'AI_TOTAL_BUDGET_MS', 120_000),
      totalBudgetAudioMs: intFrom(fromEnv, 'AI_AUDIO_TOTAL_BUDGET_MS', 240_000),
    },
    cooldown: {
      enabled: envBoolFrom(fromEnv, 'AI_COOLDOWN_ENABLED', true),
      threshold: intFrom(fromEnv, 'AI_COOLDOWN_THRESHOLD', 3),
      durationMs: intFrom(fromEnv, 'AI_COOLDOWN_MS', 30_000),
    },
    failoverDisabled,
  };
}

/** OpenAI audio model id (empty string disables the OpenAI audio path). */
export function openAiAudioModel(fromEnv: NodeJS.ProcessEnv = process.env): string {
  const value = fromEnv['OPENAI_AUDIO_MODEL'];
  return typeof value === 'string' ? value.trim() : '';
}

// Small helpers that accept an explicit env object (keeps loadAiConfig testable).
function listFromEnvNames(envObj: NodeJS.ProcessEnv, name: string, fallback: string[]): string[] {
  const raw = typeof envObj[name] === 'string' ? (envObj[name] as string).trim() : '';
  if (!raw) return [...fallback];
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [...fallback];
}

function intFrom(envObj: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = typeof envObj[name] === 'string' ? (envObj[name] as string).trim() : '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function envBoolFrom(envObj: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = typeof envObj[name] === 'string' ? (envObj[name] as string).trim().toLowerCase() : '';
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

/** Human readable summary, safe to expose over HTTP (never includes keys). */
export function describeConfig(config: AiConfig) {
  const provider = (p: ProviderConfig) => ({
    id: p.id,
    label: p.label,
    configured: p.enabled,
    models: p.models,
    supportsAudio: p.supportsAudio,
    baseUrl: p.baseUrl,
  });
  return {
    primary: provider(config.gemini),
    fallbacks: config.alternates.map(provider),
    failoverDisabled: config.failoverDisabled,
    retry: config.retry,
    timeouts: config.timeouts,
    cooldown: config.cooldown,
  };
}

// Keep the unused-import linter quiet for the module level helpers above while
// still exporting them for tests that want process.env semantics.
export { env, envBool, envInt, listFromEnv };
