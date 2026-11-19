/** Why the Word export sent the user back to the import page, and what to tell them. */
export const EXPORT_ERRORS = {
  failed: 'The Word file could not be created. Try exporting again in a moment.',
  unavailable: 'Your answers can be exported once your DSN has been read.',
} as const;

export type ExportError = keyof typeof EXPORT_ERRORS;

/** Query parameter that carries an `ExportError` back to the import page. */
export const EXPORT_ERROR_PARAM = 'export-error';

/** The message for a query parameter value, or `undefined` when it isn't an export error. */
export function exportErrorMessage(value: unknown): string | undefined {
  return Object.entries(EXPORT_ERRORS).find(([error]) => error === value)?.[1];
}
