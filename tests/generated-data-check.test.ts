import { describe, expect, it } from 'vitest';
import { normalizeGeneratedText } from '../scripts/check-generated-data';

describe('generated data comparison', () => {
  it('treats Windows and Unix line endings as the same deterministic JSON text', () => {
    expect(normalizeGeneratedText('{\r\n  "ok": true\r\n}\r\n')).toBe('{\n  "ok": true\n}\n');
    expect(normalizeGeneratedText('{\n  "ok": true\n}\n')).toBe('{\n  "ok": true\n}\n');
  });
});
