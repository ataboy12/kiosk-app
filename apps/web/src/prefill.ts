import type { AnswerSource, ImportWarning } from '@kiosk/db';
import type { AnswerValue, Column, MappingFailure, Provenance } from '@kiosk/questionnaire';

/*
 * What the server streams to the import page once the DSN is processed. Plain JSON, so it can
 * cross from the server component to the client form.
 */

/** One stored answer: a question outside tables (`columnKey` is ""), or one table cell. */
export interface PrefilledAnswer {
  questionId: string;
  columnKey: string;
  /** Value derived from the DSN, kept so an edited value can be reset. */
  computedValue: AnswerValue;
  /** Current value (computed or edited). */
  value: AnswerValue;
  source: AnswerSource;
  /** `null` for an answer the DSN didn't pre-fill. */
  provenance: Provenance | null;
}

/** Warnings sent with the summary; the others are only counted. */
export const SUMMARY_WARNING_LIMIT = 5;

export interface PrefillSummary {
  employeeCount: number;
  /** Questions with at least one value computed from the DSN. */
  prefilledCount: number;
  period: { start: string; end: string } | null;
  /** The first `SUMMARY_WARNING_LIMIT` warnings, by line. */
  warnings: ImportWarning[];
  warningCount: number;
}

export type Prefill =
  | {
      status: 'READY';
      summary: PrefillSummary;
      /** Columns of every table question, keyed by table id. */
      columns: Record<string, Column[]>;
      answers: PrefilledAnswer[];
      /** Mapped questions that couldn't be computed: the form unlocks them empty. */
      failures: MappingFailure[];
    }
  /** The file can't be used: the user uploads another one. */
  | { status: 'FAILED'; message: string }
  /** Processing took too long or hit an unexpected error: the user can retry. */
  | { status: 'RETRY'; message: string };
