import { describe, expect, it } from 'vitest';
import { looksLikeDsn } from './read-blocks';

describe('looksLikeDsn', () => {
  it('accepts text whose first non-empty line is a DSN line', () => {
    expect(looksLikeDsn("﻿\n\nS10.G00.00.001,'Software'\nanything")).toBe(true);
    expect(looksLikeDsn("S10.G00.00,''\r\nS10.G00.00.001,'Software'")).toBe(true);
  });

  it('rejects empty text and other formats', () => {
    expect(looksLikeDsn('')).toBe(false);
    expect(looksLikeDsn('id;label\n1;a')).toBe(false);
    expect(looksLikeDsn("%PDF-1.7\nS10.G00.00.001,'Software'")).toBe(false);
  });
});
