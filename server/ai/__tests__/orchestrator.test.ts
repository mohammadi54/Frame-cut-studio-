/**
 * Integration tests for the failover orchestrator, driven against a local mock
 * of every provider wire format. These are the behaviours the task asks for:
 *
 *   - Gemini is always primary and is tried first.
 *   - Overload / rate-limit / timeout / temporary server errors on Gemini are
 *     retried, then automatically handed to the configured fallback providers.
 *   - Permanent errors (auth, unknown model, bad JSON) skip straight ahead.
 *   - When everything fails the orchestrator throws, so the existing static
 *     Mohammadi Academy fallbacks in server.ts still run untouched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadAiConfig } from '../config';
import { AiChainExhaustedError } from '../errors';
import {
  generate,
  generateJSON,
  getAiStatus,
  resetAiState,
  setRegistryForTests,
} from '../orchestrator';
import { ProviderRegistry } from '../providers';
import { MockAiServer, MockSpec, startMockAiServer } from './mockServer';

const GEMINI_PRIMARY = 'gemini:gemini-3.8-flash';
const GEMINI_SECOND = 'gemini:gemini-3.7-flash';
const OPENROUTER = 'openrouter:openai/gpt-4o-mini';
const GROQ = 'groq:llama-3.3-70b-versatile';
const ANTHROPIC = 'anthropic:claude-3-5-haiku-latest';

let mock: MockAiServer;

function envFor(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_BASE_URL: mock.url,
    GEMINI_MODEL: 'gemini-3.8-flash',
    GEMINI_FALLBACK_MODELS: 'gemini-3.7-flash',
    OPENROUTER_API_KEY: 'test-openrouter-key',
    OPENROUTER_BASE_URL: `${mock.url}/openrouter/v1`,
    OPENROUTER_MODELS: 'openai/gpt-4o-mini',
    GROQ_API_KEY: 'test-groq-key',
    GROQ_BASE_URL: `${mock.url}/groq/v1`,
    GROQ_MODELS: 'llama-3.3-70b-versatile',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    ANTHROPIC_BASE_URL: `${mock.url}/anthropic`,
    AI_FALLBACK_PROVIDER_ORDER: 'openrouter,groq,anthropic',
    AI_MAX_RETRIES_PER_TARGET: '1',
    AI_RETRY_BASE_MS: '5',
    AI_RETRY_MAX_MS: '20',
    AI_RETRY_JITTER: 'false',
    AI_COOLDOWN_ENABLED: 'false',
    AI_REQUEST_TIMEOUT_MS: '400',
    AI_AUDIO_TIMEOUT_MS: '800',
    AI_TOTAL_BUDGET_MS: '8000',
    AI_AUDIO_TOTAL_BUDGET_MS: '8000',
    ...overrides,
  } as NodeJS.ProcessEnv;
}

function useEnv(overrides: Record<string, string> = {}) {
  const env = envFor(overrides);
  const config = loadAiConfig(env);
  const registry = new ProviderRegistry(config, env);
  setRegistryForTests(registry, config);
  resetAiState();
  return { env, config, registry };
}

const request = (over: Partial<Parameters<typeof generate>[0]> = {}) => ({
  label: 'test/request',
  prompt: 'Return JSON for Mohammadi Academy',
  defaultJson: '[]',
  ...over,
});

test('setup: start mock provider server', async () => {
  mock = await startMockAiServer();
  assert.ok(mock.port > 0);
});

test('plan() puts every Gemini model first, alternates after, and is capability aware', () => {
  const { registry } = useEnv();
  const text = registry.plan('text').map((t) => `${t.provider.id}:${t.model}`);
  assert.deepEqual(text, [GEMINI_PRIMARY, GEMINI_SECOND, OPENROUTER, GROQ, ANTHROPIC]);
  assert.equal(registry.plan('text')[0].primary, true);
  assert.equal(registry.plan('text')[1].primary, false);

  // No alternate provider accepts inline audio unless explicitly configured.
  const audio = registry.plan('audio').map((t) => `${t.provider.id}:${t.model}`);
  assert.deepEqual(audio, [GEMINI_PRIMARY, GEMINI_SECOND]);
});

test('unconfigured providers are inert and DISABLE_AI_FAILOVER restores legacy single-model behaviour', () => {
  const noKeys = loadAiConfig({
    GEMINI_API_KEY: 'k',
    GEMINI_BASE_URL: mock.url,
  } as NodeJS.ProcessEnv);
  assert.equal(noKeys.gemini.enabled, true);
  assert.equal(noKeys.alternates.filter((a) => a.enabled).length, 0);
  const chain = new ProviderRegistry(noKeys, {} as NodeJS.ProcessEnv).plan('text');
  assert.deepEqual(chain.map((t) => `${t.provider.id}:${t.model}`), [
    'gemini:gemini-3.8-flash',
    'gemini:gemini-3.7-flash',
    'gemini:gemini-3.5-flash',
    'gemini:gemini-2.5-flash',
  ]);

  const legacy = loadAiConfig({
    GEMINI_API_KEY: 'k',
    GEMINI_BASE_URL: mock.url,
    OPENROUTER_API_KEY: 'or',
    DISABLE_AI_FAILOVER: 'true',
  } as NodeJS.ProcessEnv);
  const legacyChain = new ProviderRegistry(legacy, {} as NodeJS.ProcessEnv).plan('text');
  assert.deepEqual(legacyChain.map((t) => t.model), ['gemini-3.8-flash']);
});

test('happy path: primary Gemini model serves the request with no retries', async () => {
  mock.reset();
  useEnv();
  mock.queue(GEMINI_PRIMARY, [{ status: 200, text: '[{"title":"آکادمی محمدی"}]' }]);

  const result = await generateJSON({
    label: 'ai/title',
    prompt: 'Generate titles',
    defaultJson: '[]',
  });

  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-3.8-flash');
  assert.equal(result.primary, true);
  assert.equal(result.usedFailover, false);
  assert.equal(result.retried, 0);
  assert.equal(result.attempts.length, 0);
  assert.deepEqual(result.json, [{ title: 'آکادمی محمدی' }]);
  assert.equal(mock.requests.length, 1, 'exactly one upstream call');
});

test('rate limit (429) on Gemini is retried on the same model, then succeeds as primary', async () => {
  mock.reset();
  useEnv();
  mock.queue(GEMINI_PRIMARY, [
    { status: 429, retryAfter: 0 },
    { status: 200, text: '{"ok":"retried"}' },
  ]);

  const result = await generateJSON(request({ label: 'ai/title' }));

  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-3.8-flash');
  assert.equal(result.primary, true, 'a retry on the primary target is not a failover');
  assert.equal(result.usedFailover, false);
  assert.equal(result.retried, 1);
  assert.equal(result.attempts[0].reason, 'rate-limit');
  assert.equal(result.attempts[0].status, 429);
  assert.equal(result.attempts[0].transient, true);
  assert.deepEqual(result.json, { ok: 'retried' });
});

test('Retry-After from a fallback provider 429 is honoured before the retry fires', async () => {
  mock.reset();
  useEnv({
    AI_RETRY_BASE_MS: '5',
    AI_RETRY_MAX_MS: '10',
    AI_MAX_RETRIES_PER_TARGET: '1',
    AI_TOTAL_BUDGET_MS: '8000',
  });
  // Gemini is down, so the chain reaches Groq, whose adapter can read the
  // Retry-After header (the Google SDK does not expose response headers, so
  // Gemini itself falls back to our own backoff curve).
  mock.setDefault({ status: 503 });
  mock.queue(GROQ, [
    { status: 429, retryAfter: 1 },
    { status: 200, text: '{"ok":"groq after retry-after"}' },
  ]);

  const started = Date.now();
  const result = await generateJSON(request({ defaultJson: '{}' }));
  const elapsed = Date.now() - started;

  assert.equal(result.provider, 'groq');
  assert.equal(result.retried >= 1, true);
  assert.ok(elapsed >= 950, `expected >=1s Retry-After wait, got ${elapsed}ms`);
  assert.ok(elapsed < 4000, `wait should be capped, got ${elapsed}ms`);
});

test('Gemini 429 uses the configured backoff curve (SDK hides Retry-After)', async () => {
  mock.reset();
  useEnv({ AI_RETRY_BASE_MS: '120', AI_RETRY_MAX_MS: '400', AI_RETRY_JITTER: 'false' });
  mock.queue(GEMINI_PRIMARY, [
    { status: 429, retryAfter: 30 },
    { status: 200, text: '{"ok":true}' },
  ]);

  const started = Date.now();
  const result = await generateJSON(request({ defaultJson: '{}' }));
  const elapsed = Date.now() - started;

  assert.equal(result.model, 'gemini-3.8-flash');
  assert.equal(result.retried, 1);
  assert.ok(elapsed >= 110, `expected the base backoff to be applied, got ${elapsed}ms`);
});

test('sustained Gemini overload (503) fails over to the second Gemini model', async () => {
  mock.reset();
  useEnv();
  mock.queue(GEMINI_PRIMARY, [
    { status: 503 },
    { status: 503 },
  ]);
  mock.queue(GEMINI_SECOND, [{ status: 200, text: '[{"title":"from 3.7"}]' }]);

  const result = await generateJSON(request());

  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-3.7-flash');
  assert.equal(result.usedFailover, true);
  assert.equal(result.primary, false);
  assert.equal(result.attempts.length, 2, 'initial attempt + 1 retry on the primary');
  assert.ok(result.attempts.every((a) => a.reason === 'overloaded'));
  assert.deepEqual(result.json, [{ title: 'from 3.7' }]);
});

test('every Gemini model down -> OpenRouter serves automatically', async () => {
  mock.reset();
  useEnv();
  mock.queue(GEMINI_PRIMARY, [{ status: 503 }, { status: 503 }]);
  mock.queue(GEMINI_SECOND, [{ status: 429 }, { status: 429 }]);
  mock.queue(OPENROUTER, [{ status: 200, text: '```json\n{"youtubeDescription":"kit"}\n```' }]);

  const result = await generateJSON(request({ label: 'ai/content-kit', defaultJson: '{}' }));

  assert.equal(result.provider, 'openrouter');
  assert.equal(result.model, 'openai/gpt-4o-mini');
  assert.equal(result.usedFailover, true);
  assert.deepEqual(result.json, { youtubeDescription: 'kit' }, 'fenced JSON is unwrapped');
  assert.equal(mock.requestsFor(OPENROUTER).length, 1);
  // The OpenAI-compatible adapter must ask for structured output.
  assert.deepEqual(mock.requestsFor(OPENROUTER)[0].body.response_format, { type: 'json_object' });
});

test('a stalled target is not retried: timeouts advance immediately', async () => {
  mock.reset();
  useEnv({ AI_REQUEST_TIMEOUT_MS: '150', AI_MAX_RETRIES_PER_TARGET: '3' });
  const stall: MockSpec = { status: 200, delayMs: 1200, text: '{"never":"served"}' };
  mock.queue(GEMINI_PRIMARY, [stall]);
  mock.queue(GEMINI_SECOND, [stall]);
  mock.queue(OPENROUTER, [stall]);
  mock.queue(GROQ, [{ status: 200, text: '{"ok":"groq"}' }]);

  const result = await generateJSON(request({ defaultJson: '{}' }));

  assert.equal(result.provider, 'groq');
  assert.equal(mock.requestsFor(GEMINI_PRIMARY).length, 1, 'a timeout must not be retried on the same model');
  assert.equal(mock.requestsFor(GEMINI_SECOND).length, 1, 'nor on the fallback model');
  assert.equal(mock.requestsFor(OPENROUTER).length, 1, 'nor on a fallback provider');
  assert.equal(result.retried, 3, 'three stalled targets, three attempts, zero retries');
  assert.deepEqual(
    result.attempts.map((a) => `${a.provider}:${a.model}:${a.reason}`),
    [
      'gemini:gemini-3.8-flash:timeout',
      'gemini:gemini-3.7-flash:timeout',
      'openrouter:openai/gpt-4o-mini:timeout',
    ]
  );
  assert.ok(result.attempts.every((a) => a.transient), 'timeouts stay classified as transient');
});

test('timeouts are treated as temporary and fail over', async () => {
  mock.reset();
  useEnv({ AI_REQUEST_TIMEOUT_MS: '150', AI_MAX_RETRIES_PER_TARGET: '0' });
  mock.queue(GEMINI_PRIMARY, [{ status: 200, delayMs: 1200, text: '{"never":"served"}' }]);
  mock.queue(GEMINI_SECOND, [{ status: 200, delayMs: 1200, text: '{"never":"served"}' }]);
  mock.queue(OPENROUTER, [{ status: 200, delayMs: 1200, text: '{"never":"served"}' }]);
  mock.queue(GROQ, [{ status: 200, text: '{"subtitles":"from groq"}' }]);

  const result = await generateJSON(request());

  assert.equal(result.provider, 'groq', 'a fast provider must win when others stall');
  assert.equal(result.usedFailover, true);
  const reasons = result.attempts.map((a) => a.reason);
  assert.ok(reasons.every((r) => r === 'timeout'), `expected timeouts, got ${reasons.join(',')}`);
  assert.ok(result.attempts.every((a) => a.transient), 'timeouts are transient');
});

test('permanent errors (404 unknown model, 401 bad key) advance without retrying', async () => {
  mock.reset();
  useEnv({ AI_MAX_RETRIES_PER_TARGET: '2' });
  mock.queue(GEMINI_PRIMARY, [{ status: 404, body: '{"error":{"code":404,"message":"models/gemini-3.8-flash is not found"}}' }]);
  mock.queue(GEMINI_SECOND, [{ status: 401, body: '{"error":{"code":401,"message":"API key not valid"}}' }]);
  mock.queue(OPENROUTER, [{ status: 200, text: '{"ok":"openrouter"}' }]);

  const result = await generateJSON(request());

  assert.equal(result.provider, 'openrouter');
  assert.equal(mock.requestsFor(GEMINI_PRIMARY).length, 1, '404 must not be retried');
  assert.equal(mock.requestsFor(GEMINI_SECOND).length, 1, '401 must not be retried');
  assert.deepEqual(
    result.attempts.map((a) => a.reason),
    ['model-not-found', 'auth']
  );
  assert.ok(result.attempts.every((a) => a.transient === false));
});

test('invalid JSON from a provider advances to the next one instead of falling back to static content', async () => {
  mock.reset();
  useEnv({ AI_MAX_RETRIES_PER_TARGET: '0' });
  mock.queue(GEMINI_PRIMARY, [{ status: 200, text: 'Sorry, I cannot produce that.' }]);
  mock.queue(GEMINI_SECOND, [{ status: 200, text: '[]' }]);

  const result = await generateJSON(request());

  assert.equal(result.model, 'gemini-3.7-flash');
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0].reason, 'unknown');
  assert.deepEqual(result.json, []);
});

test('audio requests keep the inline waveform and skip text-only providers', async () => {
  mock.reset();
  useEnv({ AI_MAX_RETRIES_PER_TARGET: '0' });
  mock.queue(GEMINI_PRIMARY, [{ status: 503 }]);
  mock.queue(GEMINI_SECOND, [{ status: 200, text: '[{"id":"1","text":"سلام"}]' }]);

  const result = await generateJSON({
    label: 'ai/transcribe-video-audio',
    prompt: 'Transcribe this lecture',
    audio: { mimeType: 'audio/wav', dataBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEA' },
    defaultJson: '[]',
  });

  assert.equal(result.model, 'gemini-3.7-flash');
  const geminiRequests = mock.requestsFor(GEMINI_SECOND);
  assert.equal(geminiRequests.length, 1);
  assert.equal(geminiRequests[0].hasInlineAudio, true, 'audio must be forwarded as inlineData');
  assert.equal(mock.requestsFor(OPENROUTER).length, 0, 'text-only providers must be skipped');
  assert.equal(mock.requestsFor(GROQ).length, 0);
});

test('audio failover to OpenAI only happens when OPENAI_AUDIO_MODEL is configured', async () => {
  mock.reset();
  useEnv({
    AI_MAX_RETRIES_PER_TARGET: '0',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_BASE_URL: `${mock.url}/openai/v1`,
    OPENAI_AUDIO_MODEL: 'gpt-4o-audio-preview',
    AI_FALLBACK_PROVIDER_ORDER: 'openai,openrouter',
  });
  mock.queue(GEMINI_PRIMARY, [{ status: 503 }]);
  mock.queue(GEMINI_SECOND, [{ status: 503 }]);
  mock.queue('openai:gpt-4o-audio-preview', [{ status: 200, text: '[{"id":"1","text":"transcribed"}]' }]);

  const result = await generateJSON({
    label: 'ai/transcribe-video-audio',
    prompt: 'Transcribe',
    audio: { mimeType: 'audio/wav', dataBase64: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEA' },
    defaultJson: '[]',
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.model, 'gpt-4o-audio-preview');
  assert.equal(mock.requestsFor('openai:gpt-4o-audio-preview')[0].hasInputAudio, true);
});

test('when every provider fails the orchestrator throws so the static fallback still runs', async () => {
  mock.reset();
  useEnv({ AI_MAX_RETRIES_PER_TARGET: '0' });
  for (const key of [GEMINI_PRIMARY, GEMINI_SECOND, OPENROUTER, GROQ, ANTHROPIC]) {
    mock.queue(key, [{ status: 503 }]);
  }

  let thrown: any = null;
  try {
    await generateJSON(request());
  } catch (err) {
    thrown = err;
  }

  assert.ok(thrown instanceof AiChainExhaustedError, `unexpected error: ${thrown}`);
  assert.equal(thrown.attempts.length, 5, 'every target in the chain was attempted');
  assert.deepEqual(
    thrown.attempts.map((a: any) => `${a.provider}:${a.model}`),
    [GEMINI_PRIMARY, GEMINI_SECOND, OPENROUTER, GROQ, ANTHROPIC]
  );
  assert.ok(thrown.reasons.includes('overloaded'));

  // This is exactly what server.ts catch blocks rely on: a throwable error.
  assert.equal(typeof thrown.message, 'string');
});

test('Anthropic overload_error (529 style body) is transient and fails over', async () => {
  mock.reset();
  useEnv({ AI_MAX_RETRIES_PER_TARGET: '0', AI_FALLBACK_PROVIDER_ORDER: 'anthropic,openrouter' });
  mock.queue(GEMINI_PRIMARY, [{ status: 503 }]);
  mock.queue(GEMINI_SECOND, [{ status: 503 }]);
  mock.queue(ANTHROPIC, [
    { status: 500, body: '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}' },
  ]);
  mock.queue(OPENROUTER, [{ status: 200, text: '{"ok":true}' }]);

  const result = await generateJSON(request({ defaultJson: '{}' }));
  assert.equal(result.provider, 'openrouter');
  const anthropicAttempt = result.attempts.find((a) => a.provider === 'anthropic');
  assert.ok(anthropicAttempt, 'anthropic should have been attempted');
  assert.equal(anthropicAttempt!.transient, true);
});

test('cooldown parks a repeatedly overloaded target and is reported in status', async () => {
  mock.reset();
  useEnv({
    AI_COOLDOWN_ENABLED: 'true',
    AI_COOLDOWN_THRESHOLD: '2',
    AI_COOLDOWN_MS: '60000',
    AI_MAX_RETRIES_PER_TARGET: '1',
  });
  const overload: MockSpec[] = [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }];
  mock.queue(GEMINI_PRIMARY, overload);
  mock.setDefault({ status: 200, text: '{"ok":true}' });

  const first = await generateJSON(request({ defaultJson: '{}' }));
  assert.equal(first.usedFailover, true);

  const status = getAiStatus();
  const cooled = status.cooldowns.map((c: any) => c.target);
  assert.ok(cooled.includes(GEMINI_PRIMARY), `expected ${GEMINI_PRIMARY} cooling down, got ${cooled}`);

  // Second call must skip the parked target entirely (no extra 503 round trips).
  const callsBefore = mock.requestsFor(GEMINI_PRIMARY).length;
  const second = await generateJSON(request({ defaultJson: '{}' }));
  assert.equal(mock.requestsFor(GEMINI_PRIMARY).length, callsBefore, 'cooled target must be skipped');
  assert.equal(second.provider, 'gemini');
  assert.equal(second.model, 'gemini-3.7-flash');
});

test('total wall-clock budget stops the chain instead of hanging the request', async () => {
  mock.reset();
  useEnv({
    AI_REQUEST_TIMEOUT_MS: '300',
    AI_TOTAL_BUDGET_MS: '700',
    AI_MAX_RETRIES_PER_TARGET: '3',
    AI_RETRY_BASE_MS: '250',
    AI_RETRY_MAX_MS: '250',
    AI_RETRY_JITTER: 'false',
  });
  // Every target in the chain is overloaded, so only the budget can end it.
  mock.setDefault({ status: 503 });

  const started = Date.now();
  let thrown: any = null;
  try {
    await generateJSON(request());
  } catch (err) {
    thrown = err;
  }
  const elapsed = Date.now() - started;

  assert.ok(thrown instanceof AiChainExhaustedError, 'budget exhaustion must surface as a chain error');
  assert.ok(elapsed < 3000, `budget should cut the chain short, took ${elapsed}ms`);
});

test('status endpoint data never leaks key material', async () => {
  mock.reset();
  useEnv();
  const status: any = getAiStatus();
  const serialised = JSON.stringify(status);
  assert.ok(!serialised.includes('test-gemini-key'));
  assert.ok(!serialised.includes('test-openrouter-key'));
  assert.equal(status.config.primary.id, 'gemini');
  assert.equal(status.config.primary.configured, true);
  assert.ok(status.chain.text[0].includes('gemini-3.8-flash (primary)'));
  assert.ok(status.providers.find((p: any) => p.id === 'openai' && p.configured === false));
});

test('teardown: close mock provider server', async () => {
  setRegistryForTests(null, null);
  await mock.close();
});
