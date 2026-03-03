/**
 * Robust JSON extraction from LLM responses.
 *
 * Handles common LLM output quirks:
 * - Markdown code fences (```json ... ```)
 * - Trailing commas before ] or }
 * - Unescaped quotes inside strings
 * - Surrounding prose text before/after JSON
 */

/**
 * Extract and parse a JSON array from raw LLM text.
 * Throws a descriptive Error on failure.
 */
export function parseLlmJsonArray<T = unknown>(raw: string): T[] {
  const cleaned = stripCodeFences(raw);

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`No JSON array found in LLM output (${raw.length} chars)`);
  }

  let jsonStr = jsonMatch[0];
  jsonStr = fixTrailingCommas(jsonStr);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: try repairing unescaped quotes
    parsed = JSON.parse(repairJsonQuotes(jsonStr));
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Parsed result is not a non-empty array');
  }

  return parsed as T[];
}

/**
 * Extract and parse a JSON object from raw LLM text.
 * Throws a descriptive Error on failure.
 */
export function parseLlmJsonObject<T = Record<string, unknown>>(raw: string): T {
  const cleaned = stripCodeFences(raw);

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON object found in LLM output (${raw.length} chars)`);
  }

  let jsonStr = jsonMatch[0];
  jsonStr = fixTrailingCommas(jsonStr);

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return JSON.parse(repairJsonQuotes(jsonStr)) as T;
  }
}

/** Strip markdown code fences (```json ... ``` or ``` ... ```) */
function stripCodeFences(text: string): string {
  return text.replace(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g, '$1');
}

/** Remove trailing commas before ] or } */
function fixTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, '$1');
}

/** Repair unescaped double quotes inside JSON strings */
function repairJsonQuotes(raw: string): string {
  let result = '';
  let inString = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === '\\' && inString) {
      result += ch + (raw[i + 1] || '');
      i++;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        result += ch;
      } else {
        const after = raw.slice(i + 1).trimStart();
        if (after.length === 0 || /^[,}\]:]/.test(after)) {
          inString = false;
          result += ch;
        } else {
          result += '\\"';
        }
      }
    } else {
      result += ch;
    }
  }

  return result;
}
