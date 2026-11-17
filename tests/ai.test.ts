import { describe, expect, it } from 'vitest';
import { parseAiOutput } from '../server/ai.js';

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
