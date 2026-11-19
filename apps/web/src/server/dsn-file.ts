import { looksLikeDsn } from '@kiosk/dsn';

/** Largest file accepted. The sample is ~300 KB; `serverActions.bodySizeLimit` leaves room above it. */
export const MAX_DSN_BYTES = 4 * 1024 * 1024;

export type DsnFileResult =
  { ok: true; fileName: string; content: string } | { ok: false; error: string };

/**
 * The quick check done at upload, before anything is stored: a non-empty text file of
 * reasonable size whose first line is a DSN line. Parsing happens later, on the import page.
 */
export async function readDsnFile(entry: FormDataEntryValue | null): Promise<DsnFileResult> {
  // Browsers submit an empty, unnamed file when none was chosen.
  if (!(entry instanceof File) || (entry.size === 0 && entry.name === '')) {
    return { ok: false, error: 'Choose a DSN file to upload.' };
  }
  if (entry.size === 0) {
    return { ok: false, error: `${entry.name} is empty. Choose another file.` };
  }
  const sizeError = fileSizeError(entry);
  if (sizeError) return { ok: false, error: sizeError };

  const content = decodeDsn(await entry.arrayBuffer());
  // Postgres text can't hold NUL characters, and a DSN never contains them.
  if (content.includes('\u0000') || !looksLikeDsn(content)) {
    return {
      ok: false,
      error: `${entry.name} does not look like a DSN. A DSN is a text file whose lines look like S21.G00.30.001,'value'.`,
    };
  }
  return { ok: true, fileName: entry.name, content };
}

/**
 * Why a file is too large, or `null`. The upload form calls it too: Next refuses a body above
 * `bodySizeLimit` before the action runs, so a very large file must never be sent.
 */
export function fileSizeError(file: File): string | null {
  return file.size > MAX_DSN_BYTES
    ? `${file.name} is larger than ${MAX_DSN_BYTES / 1024 / 1024} MB, the most this version accepts.`
    : null;
}

/** DSN files are UTF-8 or, from older payroll software, Windows-1252 (Latin-1). */
function decodeDsn(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
