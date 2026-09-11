/**
 * AI generation orchestrator.
 *
 * Chain order (never re-ordered by failures):
 *   1. Gemini primary model            (GEMINI_MODEL, default gemini-3.8-flash)
 *   2. Gemini fallback models          (GEMINI_FALLBACK_MODELS)
 *   3. Alternate providers in AI_FALLBACK_PROVIDER_ORDER, each env-gated
 *   4. -> AiChainExhaustedError, which lands in the endpoint's existing catch
 *       block, so the static Mohammadi Academy fallbacks stay exactly as they
 *       were and remain the final safety net.
 *
 * Transient failures (429 rate-limit, 500/502/503/504 overload, 529, timeouts,
 * network resets) are retried on the same target with jittered exponential
 * backoff that honours Retry-After, then the chain advances. Non-transient
 * failures (auth, unknown model, unsupported modality, invalid JSON) advance
 * immediately. A per-attempt AbortSignal deadline plus a total wall-clock budget
 * keep a degraded provider from stalling the UI.
 */
import { AiConfig, describeConfig, loadAiConfig } from './config';
import {
  AiChainExhaustedError,
  AttemptRecord,
  ProviderError,
  classifyError,
} from './errors';
import { parseJsonLoose } from './json';
import { AiCapability, AiRequest, PlanTarget, ProviderRegistry } from './providers';

export interface AiResult<T = any> {
  /** Raw text returned by the model. */
  text: string;
  /** Parsed JSON (undefined for non-JSON requests that were not parsed). */
  json: T;
  /** Provider id that actually served the response. */
  provider: string;
  model: string;
  /** True when served by the first Gemini model (the primary target). */
  primary: boolean;
  /** True when a non-primary model/provider served the response. */
  usedFailover: boolean;
  /** Number of failed attempts that preceded this success (retries included). */
  retried: number;
  attempts: AttemptRecord[];
  durationMs: number;
}

export interface AiStats {
  served: number;
  transientFailures: number;
  permanentFailures: number;
  timeouts: number;
  cooldownSkips: number;
  lastServedBy: string | null;
  lastFailure: string | null;
}

interface CooldownState {
  consecutiveTransient: number;
  cooldownUntil: number;
}

let registry: ProviderRegistry | null = null;
let config: AiConfig | null = null;
const cooldowns = new Map<string, CooldownState>();
const stats = new Map<string, AiStats>();
let chainCounter = 0;

function targetKey(target: PlanTarget): string {
  return `${target.provider.id}:${target.model}`;
}

function statsFor(key: string): AiStats {
  let entry = stats.get(key);
  if (!entry) {
    entry = {
      served: 0,
      transientFailures: 0,
      permanentFailures: 0,
      timeouts: 0,
      cooldownSkips: 0,
      lastServedBy: null,
      lastFailure: null,
    };
    stats.set(key, entry);
  }
  return entry;
}

/** Build (or rebuild) the registry from the current environment. */
export function initAi(env: NodeJS.ProcessEnv = process.env, force = false): ProviderRegistry {
  if (registry && !force) return registry;
  config = loadAiConfig(env);
  registry = new ProviderRegistry(config, env);
  cooldowns.clear();
  return registry;
}

export function getAiConfig(): AiConfig {
  if (!config) initAi();
  return config as AiConfig;
}

export function getRegistry(): ProviderRegistry {
  if (!registry) initAi();
  return registry as ProviderRegistry;
}

/** Test helper: install a pre-built registry (e.g. pointed at a mock server). */
export function setRegistryForTests(next: ProviderRegistry | null, nextConfig?: AiConfig | null): void {
  registry = next;
  config = nextConfig ?? null;
  cooldowns.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/** Exponential backoff with full jitter, honouring a server Retry-After hint. */
export function computeBackoffMs(attempt: number, retryAfterMs: number | null, cfg: AiConfig): number {
  const { baseDelayMs, maxDelayMs, jitter } = cfg.retry;
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jittered = jitter ? Math.round(exponential * (0.5 + Math.random() * 0.5)) : exponential;
  // A server supplied Retry-After wins over our own curve. It is already capped
  // at parse time (see MAX_RETRY_AFTER_MS) and the caller refuses to sleep past
  // the total request budget.
  if (retryAfterMs && retryAfterMs > jittered) return retryAfterMs;
  return jittered;
}

/** Skip targets that tripped the cooldown; never skip the entire chain. */
function applyCooldown(targets: PlanTarget[], cfg: AiConfig): { usable: PlanTarget[]; skipped: string[] } {
  if (!cfg.cooldown.enabled) return { usable: targets, skipped: [] };
  const now = Date.now();
  const usable: PlanTarget[] = [];
  const skipped: string[] = [];
  for (const target of targets) {
    const state = cooldowns.get(targetKey(target));
    if (state && state.cooldownUntil > now) {
      skipped.push(targetKey(target));
      statsFor(targetKey(target)).cooldownSkips++;
      continue;
    }
    usable.push(target);
  }
  // If every target is cooling down, ignore the cooldowns rather than failing.
  return usable.length > 0 ? { usable, skipped } : { usable: targets, skipped: [] };
}

function noteTransient(key: string, cfg: AiConfig): void {
  const state = cooldowns.get(key) || { consecutiveTransient: 0, cooldownUntil: 0 };
  state.consecutiveTransient += 1;
  if (cfg.cooldown.enabled && state.consecutiveTransient >= cfg.cooldown.threshold) {
    state.cooldownUntil = Date.now() + cfg.cooldown.durationMs;
    state.consecutiveTransient = 0;
  }
  cooldowns.set(key, state);
}

function noteSuccess(key: string): void {
  cooldowns.delete(key);
}

function log(label: string, message: string): void {
  // Single-line, greppable log; no request bodies, no keys.
  console.log(`[ai:${label}] ${message}`);
}

export interface GenerateOptions {
  /** Parse the model output as JSON (default true). */
  json?: boolean;
  /** Value parsed when the model returns an empty body (legacy behaviour). */
  defaultJson?: string;
  /** Per-attempt timeout override in ms. */
  timeoutMs?: number;
}

/**
 * Run a generation request across the provider chain.
 * @throws AiChainExhaustedError when nothing could serve the request.
 */
export async function generate<T = any>(
  request: AiRequest,
  options: GenerateOptions = {}
): Promise<AiResult<T>> {
  const cfg = getAiConfig();
  const reg = getRegistry();
  const capability: AiCapability = request.audio ? 'audio' : 'text';
  const wantsJson = options.json ?? request.json ?? true;

  const allTargets = reg.plan(capability);
  if (allTargets.length === 0) {
    throw new AiChainExhaustedError([
      {
        provider: 'none',
        model: 'none',
        attempt: 0,
        status: null,
        reason: capability === 'audio' ? 'no-audio-capable-provider-configured' : 'no-provider-configured',
        transient: false,
        durationMs: 0,
        message: 'No AI provider is configured for this capability',
      },
    ]);
  }

  const { usable: targets, skipped } = applyCooldown(allTargets, cfg);
  if (skipped.length > 0) {
    log(request.label, `cooldown skip: ${skipped.join(', ')}`);
  }

  const chainId = ++chainCounter;
  const startedAt = Date.now();
  const isAudio = capability === 'audio';
  const perAttemptTimeout =
    request.timeoutMs ?? options.timeoutMs ?? (isAudio ? cfg.timeouts.audioMs : cfg.timeouts.textMs);
  const totalBudget = isAudio ? cfg.timeouts.totalBudgetAudioMs : cfg.timeouts.totalBudgetTextMs;
  const deadline = startedAt + totalBudget;
  const attempts: AttemptRecord[] = [];

  for (const target of targets) {
    const key = targetKey(target);
    let attempt = 0;

    // attempts allowed on this target = 1 initial + maxRetriesPerTarget retries
    while (attempt <= cfg.retry.maxRetriesPerTarget) {
      attempt += 1;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        log(request.label, `total budget ${totalBudget}ms exhausted, giving up`);
        throw new AiChainExhaustedError(attempts);
      }
      const timeoutMs = Math.max(1000, Math.min(perAttemptTimeout, remaining));
      const attemptStarted = Date.now();
      const signal = AbortSignal.timeout(timeoutMs);

      try {
        const text = await target.provider.generate(target.model, { ...request, json: wantsJson }, signal);
        const durationMs = Date.now() - attemptStarted;

        let json: any = undefined;
        if (wantsJson) {
          // Invalid JSON is a provider-level failure: try the next target
          // instead of dropping into the static fallback straight away.
          json = parseJsonLoose(text, {
            provider: target.provider.id,
            model: target.model,
            defaultJson: options.defaultJson ?? request.defaultJson,
          });
        }

        noteSuccess(key);
        const stat = statsFor(key);
        stat.served += 1;
        stat.lastServedBy = new Date().toISOString();

        const result: AiResult<T> = {
          text,
          json: json as T,
          provider: target.provider.id,
          model: target.model,
          primary: Boolean(target.primary),
          usedFailover: !target.primary,
          retried: attempts.length,
          attempts,
          durationMs: Date.now() - startedAt,
        };

        if (result.usedFailover || result.retried > 0) {
          log(
            request.label,
            `chain#${chainId} served by ${key}${result.usedFailover ? ' (failover)' : ' (primary)'} after ${attempts.length} failed attempt(s) in ${result.durationMs}ms`
          );
        }
        return result;
      } catch (err: any) {
        const durationMs = Date.now() - attemptStarted;
        const classified = classifyError(err);
        const timedOut = signal.aborted || classified.reason === 'timeout';
        const record: AttemptRecord = {
          provider: target.provider.id,
          model: target.model,
          attempt,
          status: classified.status,
          reason: timedOut && !classified.status ? 'timeout' : classified.reason,
          transient: classified.transient || timedOut,
          durationMs,
          message: classified.message,
        };
        attempts.push(record);

        const stat = statsFor(key);
        if (record.transient) stat.transientFailures += 1;
        else stat.permanentFailures += 1;
        if (timedOut) stat.timeouts += 1;
        stat.lastFailure = `${record.reason}${record.status ? ` (${record.status})` : ''} @ ${new Date().toISOString()}`;

        log(
          request.label,
          `chain#${chainId} ${key} attempt ${attempt} -> ${record.reason}${
            record.status ? ` [${record.status}]` : ''
          } ${record.transient ? '(transient)' : '(permanent)'} in ${durationMs}ms`
        );

        if (record.transient) noteTransient(key, cfg);
        else cooldowns.delete(key);

        // Permanent problems for this target: move to the next one at once.
        if (!record.transient) break;

        // A timeout means the target stalled: retrying the same model usually
        // just burns the request budget, so advance to the next one at once.
        // Cheap transient failures (429/500/502/503/504/network) are retried.
        if (record.reason === 'timeout') {
          log(request.label, `${key} timed out after ${durationMs}ms, advancing without a retry`);
          break;
        }

        const hasRetriesLeft = attempt <= cfg.retry.maxRetriesPerTarget;
        if (!hasRetriesLeft) break;

        const wait = computeBackoffMs(attempt, classified.retryAfterMs, cfg);
        if (Date.now() + wait >= deadline) {
          log(request.label, `no budget left for a ${wait}ms backoff, advancing`);
          break;
        }
        await sleep(wait);
      }
    }
  }

  throw new AiChainExhaustedError(attempts);
}

/** Convenience wrapper used by every JSON-returning endpoint in server.ts. */
export async function generateJSON<T = any>(
  request: AiRequest,
  options: Omit<GenerateOptions, 'json'> = {}
): Promise<AiResult<T>> {
  return generate<T>(request, { ...options, json: true });
}

/** Observability for GET /api/ai/status. Never exposes key material. */
export function getAiStatus() {
  const cfg = getAiConfig();
  const reg = getRegistry();
  const now = Date.now();
  return {
    ok: true,
    timestamp: now,
    config: describeConfig(cfg),
    providers: reg.snapshot(),
    chain: {
      text: reg.plan('text').map((t) => `${t.provider.id}:${t.model}${t.primary ? ' (primary)' : ''}`),
      audio: reg.plan('audio').map((t) => `${t.provider.id}:${t.model}${t.primary ? ' (primary)' : ''}`),
    },
    cooldowns: Array.from(cooldowns.entries())
      .filter(([, state]) => state.cooldownUntil > now)
      .map(([key, state]) => ({ target: key, cooldownUntil: state.cooldownUntil, remainingMs: state.cooldownUntil - now })),
    stats: Object.fromEntries(Array.from(stats.entries())),
  };
}

/** Test helper. */
export function resetAiState(): void {
  cooldowns.clear();
  stats.clear();
  chainCounter = 0;
}

export { AiChainExhaustedError, ProviderError, classifyError, parseJsonLoose };
export type { AiRequest, PlanTarget, AttemptRecord };
