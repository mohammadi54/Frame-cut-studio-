/**
 * Error classification for the AI generation pipeline.
 *
 * Every provider adapter throws a `ProviderError` (or a raw JS error which is
 * classified defensively). The orchestrator uses the classification to decide
 * between two behaviours:
 *
 *   'retry'   -> transient problem (overload / rate-limit / timeout / 5xx).
 *                Retry the *same* provider+model with jittered backoff, then
 *                move on to the next target in the chain.
 *   'advance' -> the target itself cannot serve this request right now
 *                (bad key, unknown model, unsupported modality, malformed
 *                JSON output). Skip straight to the next target.
 *
 * Nothing in here ever removes the existing per-endpoint static fallbacks in
 * server.ts: when the whole chain is exhausted the orchestrator throws
 * `AiChainExhaustedError`, the endpoint `catch` runs exactly as before.
 */

export type AiFailureMode = 'retry' | 'advance';

export interface ClassifiedError {
  /** What the orchestrator should do next. */
  mode: AiFailureMode;
  /** HTTP status when one could be determined, otherwise null. */
  status: number | null;
  /** Short, log friendly reason: 'rate-limit', 'overloaded', 'timeout', ... */
  reason: string;
  /** Server supplied Retry-After in ms when present (already clamped). */
  retryAfterMs: number | null;
  /** Original error message (trimmed) for logging. */
  message: string;
  /** True for the transient families described in the task brief. */
  transient: boolean;
}

/**
 * Error thrown by provider adapters. Extra fields let `classifyError` work
 * without fragile message sniffing, while still degrading gracefully for raw
 * errors coming from fetch / the Google SDK.
 */
export class ProviderError extends Error {
  status: number | null;
  retryAfterMs: number | null;
  provider: string;
  model: string;
  bodySnippet?: string;
  /** Set by the orchestrator when a per-attempt timeout fires. */
  timedOut?: boolean;

  constructor(
    message: string,
    options: {
      status?: number | null;
      retryAfterMs?: number | null;
      provider?: string;
      model?: string;
      bodySnippet?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.provider = options.provider ?? 'unknown';
    this.model = options.model ?? 'unknown';
    this.bodySnippet = options.bodySnippet;
    if (options.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

/** Thrown when every configured target failed; carries the full attempt log. */
export class AiChainExhaustedError extends Error {
  attempts: AttemptRecord[];
  reasons: string[];

  constructor(attempts: AttemptRecord[]) {
    const reasons = Array.from(new Set(attempts.map((a) => a.reason)));
    super(
      `All AI providers failed after ${attempts.length} attempt(s): ${reasons.join(', ') || 'unknown error'}`
    );
    this.name = 'AiChainExhaustedError';
    this.attempts = attempts;
    this.reasons = reasons;
  }
}

export interface AttemptRecord {
  provider: string;
  model: string;
  attempt: number;
  status: number | null;
  reason: string;
  transient: boolean;
  durationMs: number;
  message: string;
}

/** HTTP statuses treated as temporary / retryable. */
const TRANSIENT_STATUS = new Set([
  408, // Request Timeout
  409, // Conflict (occasionally used for concurrent capacity errors)
  425, // Too Early
  429, // Too Many Requests / rate limit
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable / model overloaded
  504, // Gateway Timeout
  509, // Bandwidth Limit Exceeded
  520, 521, 522, 524, // Cloudflare style transient failures
  529, // Anthropic "overloaded_error"
  598, 599, // Network read/connect timeout (some proxies)
]);

/** Status -> short reason used in logs and in the /api/ai/status trail. */
const STATUS_REASON: Record<number, string> = {
  408: 'timeout',
  409: 'capacity-conflict',
  425: 'too-early',
  429: 'rate-limit',
  500: 'server-error',
  502: 'bad-gateway',
  503: 'overloaded',
  504: 'gateway-timeout',
  509: 'capacity-limit',
  529: 'overloaded',
};

/** Message patterns that indicate a temporary failure (case-insensitive). */
const TRANSIENT_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(rate[\s_-]?limit(ed|s)?|too many requests|quota (exceeded|exhausted))\b/i, reason: 'rate-limit' },
  { re: /\bresource exhausted\b/i, reason: 'rate-limit' },
  { re: /\b(overloaded|overload(ed)? (model|error)|model is overloaded|capacity)\b/i, reason: 'overloaded' },
  { re: /\b(service|temporarily) unavailable\b/i, reason: 'overloaded' },
  { re: /\b(unavailable|try again later|please retry|retry later|backoff)\b/i, reason: 'overloaded' },
  { re: /\b(deadline exceeded|timed? ?out|timeout|etimedout|esockettimedout)\b/i, reason: 'timeout' },
  { re: /\b(internal (server )?error|bad gateway|gateway (time ?out)|server error|502|503|504)\b/i, reason: 'server-error' },
  { re: /\b(econnreset|econnaborted|epipe|eai_again|enotfound|ehostunreach|enetunreach)\b/i, reason: 'network' },
  { re: /\b(socket hang up|fetch failed|network (error|request failed)|connection (closed|reset|error|lost)|terminated|und_err_(socket|connect_timeout|headers_timeout|body_timeout))\b/i, reason: 'network' },
  { re: /\babort(ed|error)\b/i, reason: 'timeout' },
];

/** Message patterns that indicate the target can never serve this request. */
const ADVANCE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(api[_ ]?key|apikey|credential|unauthoriz(ed|ation)|invalid auth|permission denied|forbidden|access denied)\b/i, reason: 'auth' },
  { re: /\b(not found|unknown model|model .*does not exist|unsupported model|no such model|404)\b/i, reason: 'model-not-found' },
  { re: /\b(billing|payment required|insufficient (quota|balance|credit)|exceeded your current quota)\b/i, reason: 'billing' },
  { re: /\b(invalid (request|argument|json)|malformed|unsupported (modality|media|content)|cannot (process|handle) (audio|image)|400|422)\b/i, reason: 'invalid-request' },
  { re: /\b(content (policy|filter)|safety|blocked|recitation)\b/i, reason: 'content-policy' },
  { re: /\btoo large|payload too large|request entity too large|413\b/i, reason: 'payload-too-large' },
];

/** Upper bound for a server supplied Retry-After we are willing to honour. */
const MAX_RETRY_AFTER_MS = 8000;

function firstNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) return Number(value.trim());
  }
  return null;
}

/** Pull an HTTP status out of the many shapes SDK / fetch errors arrive in. */
export function extractStatus(err: any): number | null {
  if (!err) return null;
  const direct = firstNumber(
    err.status,
    err.statusCode,
    err.httpStatusCode,
    err?.response?.status,
    err?.response?.statusCode,
    err?.error?.status,
    err?.error?.code,
    err?.cause?.status,
    err?.cause?.statusCode,
    err?.details?.status
  );
  if (direct) return direct;

  // "[429 Too Many Requests]" / "HTTP 503" / "status code 500"
  const message = String(err.message || err);
  const bracket = message.match(/\[(\d{3})\b/);
  if (bracket) return Number(bracket[1]);
  const httpish = message.match(/\b(?:http|status(?: code)?|code)\s*:?\s*(\d{3})\b/i);
  if (httpish) return Number(httpish[1]);
  return null;
}

/**
 * Parse a Retry-After value (delta-seconds or HTTP-date) into milliseconds.
 * Values above MAX_RETRY_AFTER_MS are dropped so a hostile/huge header cannot
 * stall a user request; the orchestrator advances to the next provider instead.
 */
export function parseRetryAfterMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw > 1000 ? raw : raw * 1000; // tolerate ms or seconds
    return ms >= 0 && ms <= MAX_RETRY_AFTER_MS ? Math.round(ms) : null;
  }
  if (typeof raw !== 'string' || !raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return ms <= MAX_RETRY_AFTER_MS ? Math.round(ms) : null;
  }
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 && delta <= MAX_RETRY_AFTER_MS ? Math.round(delta) : null;
  }
  return null;
}

function extractRetryAfterMs(err: any): number | null {
  if (!err) return null;
  // `retryAfterMs` is already normalised to milliseconds by our adapters, so it
  // must not be fed back through parseRetryAfterMs (which reads bare numbers as
  // delta-seconds and would discard anything above the cap).
  if (typeof err.retryAfterMs === 'number' && Number.isFinite(err.retryAfterMs)) {
    const ms = Math.round(err.retryAfterMs);
    return ms >= 0 && ms <= MAX_RETRY_AFTER_MS ? ms : null;
  }
  const candidates = [
    err.retryAfter,
    err?.headers?.get?.('retry-after'),
    err?.response?.headers?.get?.('retry-after'),
    err?.response?.headers?.['retry-after'],
    err?.headers?.['retry-after'],
  ];
  for (const candidate of candidates) {
    const parsed = parseRetryAfterMs(candidate);
    if (parsed !== null) return parsed;
  }
  const message = String(err.message || '');
  const inline = message.match(/retry[- ]?after[^0-9]{0,12}(\d+(?:\.\d+)?)/i);
  if (inline) return parseRetryAfterMs(inline[1]);
  return null;
}

/**
 * Classify any error thrown during an AI attempt.
 *
 * Precedence: explicit HTTP status -> abort/timeout markers -> transient
 * message patterns -> permanent message patterns -> unknown (treated as
 * 'advance' so a weird error cannot loop forever, but the chain keeps going).
 */
export function classifyError(err: any): ClassifiedError {
  const message = String(err?.message || err || 'unknown error').split('\n')[0].slice(0, 400);
  const status = extractStatus(err);
  const retryAfterMs = extractRetryAfterMs(err);
  const name = String(err?.name || '');

  // Our own per-attempt deadline (AbortSignal.timeout) surfaces as AbortError /
  // TimeoutError; the orchestrator also flags it explicitly.
  const isAbort =
    err?.timedOut === true ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    err?.code === 'ABORT_ERR' ||
    err?.code === 'ETIMEDOUT';
  if (isAbort && !status) {
    return { mode: 'retry', status: null, reason: 'timeout', retryAfterMs, message, transient: true };
  }

  if (status) {
    if (TRANSIENT_STATUS.has(status)) {
      return {
        mode: 'retry',
        status,
        reason: STATUS_REASON[status] || 'server-error',
        retryAfterMs,
        message,
        transient: true,
      };
    }
    if (status === 401 || status === 403) {
      return { mode: 'advance', status, reason: 'auth', retryAfterMs, message, transient: false };
    }
    if (status === 404) {
      return { mode: 'advance', status, reason: 'model-not-found', retryAfterMs, message, transient: false };
    }
    if (status === 402) {
      return { mode: 'advance', status, reason: 'billing', retryAfterMs, message, transient: false };
    }
    if (status >= 400 && status < 500) {
      return { mode: 'advance', status, reason: 'invalid-request', retryAfterMs, message, transient: false };
    }
    // Unknown 5xx -> temporary server error.
    if (status >= 500) {
      return { mode: 'retry', status, reason: 'server-error', retryAfterMs, message, transient: true };
    }
  }

  for (const { re, reason } of TRANSIENT_PATTERNS) {
    if (re.test(message)) {
      return { mode: 'retry', status, reason, retryAfterMs, message, transient: true };
    }
  }
  for (const { re, reason } of ADVANCE_PATTERNS) {
    if (re.test(message)) {
      return { mode: 'advance', status, reason, retryAfterMs, message, transient: false };
    }
  }

  return { mode: 'advance', status, reason: 'unknown', retryAfterMs, message, transient: false };
}

/** Convenience predicate used by tests and logging. */
export function isTransientError(err: any): boolean {
  return classifyError(err).transient;
}

/** Build a ProviderError from a non-OK fetch Response. */
export async function providerErrorFromResponse(
  res: Response,
  info: { provider: string; model: string }
): Promise<ProviderError> {
  let bodySnippet = '';
  try {
    bodySnippet = (await res.text()).slice(0, 400);
  } catch {
    bodySnippet = '';
  }
  let parsedStatus: number | null = res.status;
  let message = bodySnippet || res.statusText || `HTTP ${res.status}`;
  // Some gateways wrap the real status inside the JSON body.
  try {
    const parsedBody = JSON.parse(bodySnippet);
    const inner = parsedBody?.error;
    if (inner?.message) message = `${inner.message}`;
    const innerStatus = firstNumber(inner?.status, inner?.code, parsedBody?.status);
    if (innerStatus && innerStatus >= 400) parsedStatus = innerStatus;
  } catch {
    /* body was not JSON, keep the raw snippet */
  }
  return new ProviderError(message, {
    status: parsedStatus,
    retryAfterMs: parseRetryAfterMs(res.headers.get('retry-after')),
    provider: info.provider,
    model: info.model,
    bodySnippet,
  });
}
