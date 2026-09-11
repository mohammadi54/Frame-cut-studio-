/**
 * Unit tests for lenient JSON extraction. Well formed Gemini output must parse
 * exactly as the legacy `JSON.parse(response.text || "[]")` did; messy output
 * from a fallback provider must still be usable instead of dropping the request
 * into the static content fallback.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ProviderError, classifyError } from '../errors';
import { parseJsonLoose } from '../json';

test('parses well formed payloads unchanged (legacy parity)', () => {
  assert.deepEqual(parseJsonLoose('[{"title":"a"}]', { defaultJson: '[]' }), [{ title: 'a' }]);
  assert.deepEqual(parseJsonLoose('{"youtubeDescription":"x"}', { defaultJson: '{}' }), {
    youtubeDescription: 'x',
  });
  // Empty body mirrors `JSON.parse(response.text || "[]")`.
  assert.deepEqual(parseJsonLoose('', { defaultJson: '[]' }), []);
  assert.deepEqual(parseJsonLoose(null, { defaultJson: '{}' }), {});
  assert.deepEqual(parseJsonLoose('   \n ', { defaultJson: '[]' }), []);
});

test('strips markdown fences added by non-Google providers', () => {
  const fenced = '```json\n[{"id":"1","text":"سلام"}]\n```';
  assert.deepEqual(parseJsonLoose(fenced, { defaultJson: '[]' }), [{ id: '1', text: 'سلام' }]);

  const fencedNoLang = '```\n{"a":1}\n```';
  assert.deepEqual(parseJsonLoose(fencedNoLang, { defaultJson: '{}' }), { a: 1 });
});

test('extracts JSON surrounded by commentary', () => {
  const noisy = 'Sure! Here are the titles you asked for:\n[{"title":"Mohammadi Academy"}]\nHope that helps!';
  assert.deepEqual(parseJsonLoose(noisy, { defaultJson: '[]' }), [{ title: 'Mohammadi Academy' }]);
});

test('handles nested structures, braces inside strings and escaped quotes', () => {
  const nested = '{"a":{"b":[{"c":"}{"},{"d":"he said \\"hi\\""}]}}';
  const parsed = parseJsonLoose(nested, { defaultJson: '{}' });
  assert.equal(parsed.a.b[0].c, '}{');
  assert.equal(parsed.a.b[1].d, 'he said "hi"');
});

test('tolerates a trailing comma', () => {
  assert.deepEqual(parseJsonLoose('{"a":1,}', { defaultJson: '{}' }), { a: 1 });
});

test('unusable output raises an advance-classified ProviderError', () => {
  let thrown: any = null;
  try {
    parseJsonLoose('I cannot help with that request.', {
      defaultJson: '[]',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
    });
  } catch (err) {
    thrown = err;
  }
  assert.ok(thrown instanceof ProviderError, 'should throw ProviderError');
  assert.equal(thrown.provider, 'groq');
  assert.equal(classifyError(thrown).mode, 'advance');
  assert.match(thrown.message, /not valid JSON/);

  // Empty body with no default is also an advance, not a silent success.
  assert.throws(() => parseJsonLoose(''), ProviderError);
});
