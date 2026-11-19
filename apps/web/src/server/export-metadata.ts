import { formatPeriod } from '~/format-period';

/*
 * What the Word export says about its import, and the name it downloads under. Pure, so it is
 * tested without a database.
 */

/** Longest part of the upload's name kept in the download name. Upload names have no limit. */
const MAX_BASE_LENGTH = 100;
/** Added to the upload's name: `dsn.txt` downloads as `dsn-S1-6.docx`. */
const SUFFIX = '-S1-6.docx';
/** Used when nothing is left of the upload's name. */
const FALLBACK_BASE = 'dsn';

export interface ImportDetails {
  fileName: string;
  companyName: string | null;
  siren: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

/** The lines written under the document's title. */
export function exportDetails(dsnImport: ImportDetails): string[] {
  const { companyName, siren, periodStart, periodEnd, fileName } = dsnImport;
  const details: string[] = [];
  if (companyName) {
    const company = siren ? `${companyName} (SIREN ${siren})` : companyName;
    details.push(`Company: ${company}`);
  }
  if (periodStart && periodEnd) {
    details.push(`Reporting period: ${formatPeriod({ start: periodStart, end: periodEnd })}`);
  }
  details.push(`Source file: ${fileName}`);
  return details;
}

/**
 * The `Content-Disposition` header that downloads the export under the upload's name. Browsers
 * read the UTF-8 `filename*` (RFC 6266); older ones fall back to the ASCII `filename`.
 */
export function attachmentHeader(uploadName: string): string {
  const base =
    uploadName
      .replace(/\.[^.]*$/, '')
      .trim()
      .slice(0, MAX_BASE_LENGTH) || FALLBACK_BASE;
  const ascii =
    base
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // Accents split off by NFKD: "é" becomes "e".
      .replace(/[^\w.-]+/g, '_')
      .replace(/^[_.]+|_+$/g, '') || FALLBACK_BASE;
  return `attachment; filename="${ascii}${SUFFIX}"; filename*=UTF-8''${encodeRfc5987(base + SUFFIX)}`;
}

/** Percent-encodes a header parameter value: `encodeURIComponent` leaves `'()*` as they are. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
