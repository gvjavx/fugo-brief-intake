import { describe, expect, it } from 'vitest';
import { ApiError } from '@google/genai';
import { describeAiError, isRetryable, parseAiOutput } from '../server/ai.js';

const valid = {
  summary: 'PT Kopi Senja butuh website company profile dalam 6 minggu.',
  service_category: 'Website',
  priority: 'High',
  priority_reason: 'Budget Rp25-50 juta dan kebutuhan jelas.',
  missing_info: ['Apakah sudah punya domain?'],
  reply_draft: 'Halo Rina, terima kasih atas brief-nya.',
};

describe('parseAiOutput', () => {
  it('accepts output that matches the schema', () => {
    expect(parseAiOutput(JSON.stringify(valid))).toEqual(valid);
  });

  it('rejects empty output', () => {
    expect(() => parseAiOutput('')).toThrow('kosong');
    expect(() => parseAiOutput(undefined)).toThrow('kosong');
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseAiOutput('Berikut ringkasannya: ...')).toThrow('bukan JSON');
  });

  it('rejects a category outside the allowed list and names the field', () => {
    const bad = { ...valid, service_category: 'Video Production' };
    expect(() => parseAiOutput(JSON.stringify(bad))).toThrow('service_category');
  });

  it('rejects missing fields', () => {
    const { priority: _, ...withoutPriority } = valid;
    expect(() => parseAiOutput(JSON.stringify(withoutPriority))).toThrow('priority');
  });
});

describe('Gemini error handling', () => {
  const apiError = (status: number) => new ApiError({ message: '{"error":{}}', status });
  const timeout = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });

  it('retries overload, rate limit and timeout, but not bad requests', () => {
    expect(isRetryable(apiError(503))).toBe(true);
    expect(isRetryable(apiError(429))).toBe(true);
    expect(isRetryable(timeout)).toBe(true);
    expect(isRetryable(apiError(400))).toBe(false);
    expect(isRetryable(apiError(404))).toBe(false);
    expect(isRetryable(new Error('Output LLM bukan JSON yang valid'))).toBe(false);
  });

  it('turns raw API errors into messages the sales team can act on', () => {
    expect(describeAiError(apiError(503))).toContain('sibuk');
    expect(describeAiError(timeout)).toContain('tidak merespons');
    expect(describeAiError(apiError(404))).toBe('Gemini menolak request (404).');
  });
});
