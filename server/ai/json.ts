/**
 * Lenient JSON extraction for model output.
 *
 * The original endpoints did `JSON.parse(response.text || "[]")`, which throws
 * (and therefore drops straight into the static fallback) whenever a model wraps
 * its answer in a ```json fence or adds a sentence around the payload. Failing
 * over to another provider is much better than silently serving canned content,
 * so parsing happens here and a genuinely unusable payload is reported as an
 * `invalid-json` ProviderError, which the orchestrator treats as 'advance'.
 *
 * Behaviour for well formed Gemini output is unchanged.
 */
import { ProviderError } from './errors';

/** Find the first balanced JSON object/array in `text`, honouring strings. */
function sliceBalancedJson(text: string): string | null {
  const start = (() => {
    const obj = text.indexOf('{');
    const arr = text.indexOf('[');
    if (obj === -1) return arr;
    if (arr === -1) return obj;
    return Math.min(obj, arr);
  })();
  if (start === -1) return null;

  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export interface ParseJsonOptions {
  /** Provider id used when reporting an unusable payload. */
  provider?: string;
  /** Model id used when reporting an unusable payload. */
  model?: string;
  /**
   * Mirrors the legacy `response.text || "[]"` behaviour: when the model
   * returns an empty body this string is parsed instead of raising an error.
   */
  defaultJson?: string;
}

/**
 * Parse model output into JSON.
 * @throws ProviderError (classified as 'advance') when nothing usable is found.
 */
export function parseJsonLoose(text: string | null | undefined, options: ParseJsonOptions = {}): any {
  const raw = (text ?? '').trim();

  if (!raw) {
    if (options.defaultJson !== undefined) {
      try {
        return JSON.parse(options.defaultJson);
      } catch {
        /* fall through to the error below */
      }
    }
    throw new ProviderError('Model returned an empty response body', {
      provider: options.provider,
      model: options.model,
    });
  }

  // 1. Fast path: already valid JSON (unchanged behaviour for Gemini).
  try {
    return JSON.parse(raw);
  } catch {
    /* keep trying */
  }

  // 2. Markdown fenced block: ```json ... ```
  const fence = raw.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      const balanced = sliceBalancedJson(inner);
      if (balanced) {
        try {
          return JSON.parse(balanced);
        } catch {
          /* keep trying */
        }
      }
    }
  }

  // 3. First balanced structure anywhere in the text.
  const balanced = sliceBalancedJson(raw);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      /* keep trying */
    }
  }

  // 4. Trailing commas / single quotes are common LLM artefacts.
  const cleaned = balanced ?? raw;
  try {
    return JSON.parse(cleaned.replace(/,\s*([}\]])/g, '$1'));
  } catch {
    /* give up */
  }

  throw new ProviderError('Model output was not valid JSON', {
    provider: options.provider,
    model: options.model,
    bodySnippet: raw.slice(0, 200),
  });
}
