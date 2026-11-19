import { describe, expect, it } from 'vitest';
import { date } from './fields';

describe('date', () => {
  const { read } = date('001');

  it('converts YYYYMMDD to an ISO date', () => {
    expect(read('20251130')).toBe('2025-11-30');
    expect(read('20240229')).toBe('2024-02-29');
  });

  it.each(['20250231', '20251301', '20251100', '2025113', '30/11/2025'])('rejects %j', (raw) => {
    expect(read(raw)).toBeNull();
  });
});
