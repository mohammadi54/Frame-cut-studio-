/**
 * Unit tests for transient/permanent error classification and Retry-After
 * parsing - the decision layer that drives Gemini -> fallback failover.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AiChainExhaustedError,
  ProviderError,
  classifyError,
  extractStatus,
  isTransientError,
  parseRetryAfterMs,
} from '../errors';

test('classifies Gemini rate-limit (429) as transient', () => {
  const err = new ProviderError('{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}', {
    status: 429,
    provider: 'gemini',
    model: 'gemini-3.8-flash',
  });
  const classified = classifyError(err);
  assert.equal(classified.mode, 'retry');
  assert.equal(classified.transient, true);
  assert.equal(classified.status, 429);
  assert.equal(classified.reason, 'rate-limit');
});

test('classifies model overload (503 / 529 / RESOURCE_EXHAUSTED text) as transient', () => {
  for (const status of [500, 502, 503, 504, 509, 529]) {
    const classified = classifyError(new ProviderError('mock failure', { status }));
    assert.equal(classified.transient, true, `status ${status} should be transient`);
    assert.equal(classified.mode, 'retry');
  }

  const byMessage = classifyError(new Error('The model is overloaded. Please try again later.'));
  assert.equal(byMessage.transient, true);
  assert.equal(byMessage.reason, 'overloaded');

  const resourceExhausted = classifyError(new Error('RESOURCE_EXHAUSTED: quota exceeded for this project'));
  assert.equal(resourceExhausted.transient, true);
  assert.equal(resourceExhausted.reason, 'rate-limit');
});

test('classifies timeouts and network resets as transient', () => {
  const cases: Array<[string, Error]> = [
    ['abort', Object.assign(new Error('This operation was aborted'), { name: 'AbortError' })],
    ['timeout-error', Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })],
    ['etimedout', Object.assign(new Error('connect ETIMEDOUT 142.250.0.95:443'), { code: 'ETIMEDOUT' })],
    ['econnreset', new Error('read ECONNRESET')],
    ['socket-hang-up', new Error('socket hang up')],
    ['fetch-failed', new Error('fetch failed')],
    ['undici', new Error('UND_ERR_SOCKET: other side closed')],
    ['deadline', new Error('Deadline exceeded while waiting for model')],
  ];
  for (const [name, err] of cases) {
    const classified = classifyError(err);
    assert.equal(classified.transient, true, `${name} should be transient`);
    assert.equal(classified.mode, 'retry', `${name} should retry`);
  }
});

test('classifies permanent failures as advance (never retried on the same target)', () => {
  const cases: Array<[number, string]> = [
    [400, 'invalid-request'],
    [401, 'auth'],
    [403, 'auth'],
    [404, 'model-not-found'],
    [402, 'billing'],
    [422, 'invalid-request'],
    [413, 'invalid-request'],
  ];
  for (const [status, reason] of cases) {
    const classified = classifyError(new ProviderError(`HTTP ${status}`, { status }));
    assert.equal(classified.mode, 'advance', `status ${status} should advance`);
    assert.equal(classified.transient, false);
    assert.equal(classified.reason, reason);
  }

  const badKey = classifyError(new Error('API key not valid. Please pass a valid API key.'));
  assert.equal(badKey.mode, 'advance');
  assert.equal(badKey.reason, 'auth');

  const unknownModel = classifyError(new Error('models/gemini-9.9-flash is not found for API version v1beta'));
  assert.equal(unknownModel.mode, 'advance');
  assert.equal(unknownModel.reason, 'model-not-found');
});

test('status 429 wins over a permanent-looking message body', () => {
  // Gemini wraps quota errors with text that also mentions "invalid" sometimes;
  // the numeric status must dominate.
  const classified = classifyError(
    new ProviderError('Invalid request: quota invalid', { status: 429 })
  );
  assert.equal(classified.transient, true);
  assert.equal(classified.reason, 'rate-limit');
});

test('extracts statuses from the many shapes SDK and fetch errors arrive in', () => {
  assert.equal(extractStatus({ status: 503 }), 503);
  assert.equal(extractStatus({ statusCode: 429 }), 429);
  assert.equal(extractStatus({ response: { status: 500 } }), 500);
  assert.equal(extractStatus({ error: { code: 503 } }), 503);
  assert.equal(extractStatus(new Error('[429 Too Many Requests]')), 429);
  assert.equal(extractStatus(new Error('HTTP 503: Service Unavailable')), 503);
  assert.equal(extractStatus(new Error('status code 504')), 504);
  assert.equal(extractStatus(new Error('no status here')), null);
  assert.equal(extractStatus(null), null);
});

test('parses Retry-After from delta-seconds, HTTP-date and provider fields', () => {
  assert.equal(parseRetryAfterMs('2'), 2000);
  assert.equal(parseRetryAfterMs(2), 2000);
  assert.equal(parseRetryAfterMs('0.5'), 500);

  const future = new Date(Date.now() + 3000).toUTCString();
  const parsedDate = parseRetryAfterMs(future);
  assert.ok(parsedDate !== null && parsedDate > 1500 && parsedDate <= 3500, `got ${parsedDate}`);

  // Anything beyond the safety cap is dropped so a huge header cannot stall a request.
  assert.equal(parseRetryAfterMs('600'), null);
  assert.equal(parseRetryAfterMs('garbage'), null);

  const err = new ProviderError('rate limited', { status: 429, retryAfterMs: 1500 });
  assert.equal(classifyError(err).retryAfterMs, 1500);

  const inline = classifyError(new Error('429 Too Many Requests, retry-after 3 seconds'));
  assert.equal(inline.retryAfterMs, 3000);
});

test('isTransientError helper mirrors classifyError', () => {
  assert.equal(isTransientError(new ProviderError('overloaded', { status: 503 })), true);
  assert.equal(isTransientError(new ProviderError('bad key', { status: 401 })), false);
});

test('AiChainExhaustedError carries the full attempt trail', () => {
  const err = new AiChainExhaustedError([
    {
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      attempt: 1,
      status: 503,
      reason: 'overloaded',
      transient: true,
      durationMs: 12,
      message: 'mock',
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      attempt: 1,
      status: 429,
      reason: 'rate-limit',
      transient: true,
      durationMs: 8,
      message: 'mock',
    },
  ]);
  assert.equal(err.name, 'AiChainExhaustedError');
  assert.equal(err.attempts.length, 2);
  assert.deepEqual(err.reasons.sort(), ['overloaded', 'rate-limit']);
  assert.match(err.message, /All AI providers failed after 2 attempt/);
});
