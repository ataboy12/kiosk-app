import { describe, expect, it } from 'vitest';
import { attachmentHeader, exportDetails, type ImportDetails } from './export-metadata';

const IMPORT: ImportDetails = {
  fileName: 'dsn.txt',
  companyName: 'ACME',
  siren: '397096943',
  periodStart: '2025-11-01',
  periodEnd: '2025-12-31',
};

describe('exportDetails', () => {
  it('lists the company with its SIREN, the reporting period and the source file', () => {
    expect(exportDetails(IMPORT)).toEqual([
      'Company: ACME (SIREN 397096943)',
      'Reporting period: 1 November 2025 – 31 December 2025',
      'Source file: dsn.txt',
    ]);
  });

  it('leaves out what the DSN did not give', () => {
    expect(exportDetails({ ...IMPORT, siren: null, periodEnd: null })).toEqual([
      'Company: ACME',
      'Source file: dsn.txt',
    ]);
    expect(exportDetails({ ...IMPORT, companyName: null })).toEqual([
      'Reporting period: 1 November 2025 – 31 December 2025',
      'Source file: dsn.txt',
    ]);
  });
});

describe('attachmentHeader', () => {
  it('names the download after the upload, without its extension', () => {
    expect(attachmentHeader('dsn.txt')).toBe(
      `attachment; filename="dsn-S1-6.docx"; filename*=UTF-8''dsn-S1-6.docx`,
    );
  });

  it('keeps accents in the UTF-8 name and drops them from the ASCII one', () => {
    expect(attachmentHeader('Société 2025.dsn')).toBe(
      `attachment; filename="Societe_2025-S1-6.docx"; filename*=UTF-8''Soci%C3%A9t%C3%A9%202025-S1-6.docx`,
    );
  });

  it('falls back to "dsn" when nothing ASCII is left, and encodes quotes and brackets', () => {
    expect(attachmentHeader('декабрь.txt')).toMatch(/^attachment; filename="dsn-S1-6.docx"; /);
    expect(attachmentHeader(`a"b'(c).txt`)).toBe(
      `attachment; filename="a_b_c-S1-6.docx"; filename*=UTF-8''a%22b%27%28c%29-S1-6.docx`,
    );
    expect(attachmentHeader('.txt')).toMatch(/filename="dsn-S1-6.docx"/);
  });

  it('caps the length of a long upload name', () => {
    const header = attachmentHeader(`${'a'.repeat(300)}.txt`);
    expect(header).toContain(`filename="${'a'.repeat(100)}-S1-6.docx"`);
  });
});
