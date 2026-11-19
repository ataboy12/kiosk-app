import type { IsoDate } from '@kiosk/dsn';

/*
 * Everything here is plain JSON, so trees and mapping results can be stored in `jsonb` columns or
 * passed from a server to a client component.
 */

/** Normalised `content` of questions.csv. GROUP is the empty value: a title with children. */
export type QuestionContent = 'GROUP' | 'NUMBER' | 'TEXT' | 'ENUM' | 'TABLE';

/** One row of questions.csv, as stored in the database. Nesting comes from `parentId` + `order`. */
export interface QuestionDefinition {
  id: string;
  labelEn: string;
  labelFr: string;
  content: QuestionContent;
  parentId: string | null;
  order: number;
  unit: string | null;
  enumEn: string[];
  enumFr: string[];
}

/** A question with its children sorted by `order`. A TABLE's children are its rows. */
export interface QuestionNode extends QuestionDefinition {
  children: QuestionNode[];
}

export type AnswerValue = number | string | null;

/** A table column: one value of the table's breakdown (a country, a contract × gender pair, …). */
export interface Column {
  /** Stable key, stored as the answer's `columnKey`. */
  key: string;
  label: string;
}

/** How a computed answer was obtained, shown to the user next to the value. */
export interface Provenance {
  /** Plain-language description of the calculation. */
  method: string;
  /** DSN rubriques read, e.g. `S21.G00.30.005`. */
  rubriques: string[];
  /** Caveats about the data, e.g. unrecognised codes. */
  notes: string[];
}

/** One computed value: a question outside tables (`columnKey` is ""), or one table cell. */
export interface ComputedAnswer {
  questionId: string;
  columnKey: string;
  value: AnswerValue;
  provenance: Provenance;
}

/** A question the mapping should answer but couldn't. The form unlocks it empty with `message`. */
export interface MappingFailure {
  questionId: string;
  message: string;
}

export interface ReportingPeriod {
  start: IsoDate;
  end: IsoDate;
  /** Where the dates come from, in plain language. */
  source: string;
}

export interface MappingResult {
  /** `null` when the DSN has no usable date; every mapped question then fails. */
  period: ReportingPeriod | null;
  /** Columns of every TABLE question in the tree, keyed by table id. */
  columns: Record<string, Column[]>;
  answers: ComputedAnswer[];
  failures: MappingFailure[];
  /** Distinct employee identifiers in the DSN. */
  employeeCount: number;
}
