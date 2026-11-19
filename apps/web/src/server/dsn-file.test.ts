import { describe, expect, it } from 'vitest';
import { MAX_DSN_BYTES, readDsnFile } from './dsn-file';

const DSN_LINES = "S10.G00.00,''\nS10.G00.00.001,'Paie'\n";

function file(content: BlobPart, name = 'dsn.txt') {
  return new File([content], name, { type: 'text/plain' });
}

describe('readDsnFile', () => {
  it('reads a UTF-8 DSN', async () => {
    expect(await readDsnFile(file(DSN_LINES))).toEqual({
      ok: true,
      fileName: 'dsn.txt',
      content: DSN_LINES,
    });
  });

  it('falls back to Windows-1252 when the file is not valid UTF-8', async () => {
    // "Société" in Latin-1: é is the single byte 0xE9.
    const bytes = new Uint8Array([...new TextEncoder().encode("S21.G00.06.003,'Soci"), 0xe9, 0x27]);
    const result = await readDsnFile(file(bytes));
    expect(result).toMatchObject({ ok: true, content: "S21.G00.06.003,'Socié'" });
  });

  it('asks for a file when none was chosen', async () => {
    expect(await readDsnFile(null)).toEqual({ ok: false, error: 'Choose a DSN file to upload.' });
    expect(await readDsnFile(file('', ''))).toEqual({
      ok: false,
      error: 'Choose a DSN file to upload.',
    });
    expect(await readDsnFile('dsn.txt')).toMatchObject({ ok: false });
  });

  it('rejects empty, oversized and non-DSN files with a message naming the file', async () => {
    expect(await readDsnFile(file(''))).toEqual({
      ok: false,
      error: 'dsn.txt is empty. Choose another file.',
    });
    expect(await readDsnFile(file('x'.repeat(MAX_DSN_BYTES + 1)))).toMatchObject({
      ok: false,
      error: expect.stringContaining('larger than 4 MB'),
    });
    expect(await readDsnFile(file('id;label\n1;a', 'questions.csv'))).toMatchObject({
      ok: false,
      error: expect.stringContaining('questions.csv does not look like a DSN'),
    });
    expect(await readDsnFile(file(`${DSN_LINES}\u0000`))).toMatchObject({ ok: false });
  });
});
