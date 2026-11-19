import { describe, expect, it } from 'vitest';
import { EXPORT_ERRORS, exportErrorMessage } from './export-errors';

describe('exportErrorMessage', () => {
  it('gives the message of a known error, and nothing for any other value', () => {
    expect(exportErrorMessage('failed')).toBe(EXPORT_ERRORS.failed);
    expect(exportErrorMessage('toString')).toBeUndefined();
    expect(exportErrorMessage(['failed'])).toBeUndefined();
    expect(exportErrorMessage(undefined)).toBeUndefined();
  });
});
