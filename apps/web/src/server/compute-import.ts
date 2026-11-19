import type { DsnImport, NewAnswer } from '@kiosk/db';
import { parseDsn } from '@kiosk/dsn';
import { mapDsn, type QuestionNode } from '@kiosk/questionnaire';

/** The import's columns once processed, and its answer rows (without the import id). */
export interface ComputedImport {
  update: Pick<
    DsnImport,
    | 'status'
    | 'error'
    | 'siren'
    | 'periodStart'
    | 'periodEnd'
    | 'employeeCount'
    | 'warnings'
    | 'columns'
    | 'failures'
  >;
  answers: Omit<NewAnswer, 'importId'>[];
}

/**
 * Parses the DSN and maps it to the questions. Never throws: a file the parser rejects gives a
 * FAILED import with the parser's message, and questions that can't be computed are `failures`.
 */
export function computeImport(content: string, tree: readonly QuestionNode[]): ComputedImport {
  const parsed = parseDsn(content);
  const warnings = parsed.warnings.map(({ line, code, message }) => ({ line, code, message }));
  const empty = {
    siren: null,
    periodStart: null,
    periodEnd: null,
    employeeCount: null,
    columns: {},
    failures: [],
  };
  if (!parsed.ok) {
    return {
      update: { ...empty, status: 'FAILED', error: parsed.error.message, warnings },
      answers: [],
    };
  }

  const result = mapDsn(parsed.dsn, tree, parsed.warnings);
  return {
    update: {
      status: 'READY',
      error: null,
      siren: parsed.dsn.companies[0]?.siren ?? null,
      periodStart: result.period?.start ?? null,
      periodEnd: result.period?.end ?? null,
      employeeCount: result.employeeCount,
      warnings,
      columns: result.columns,
      failures: result.failures,
    },
    answers: result.answers.map(({ questionId, columnKey, value, provenance }) => ({
      questionId,
      columnKey,
      computedValue: value,
      value,
      source: 'COMPUTED',
      provenance,
    })),
  };
}
