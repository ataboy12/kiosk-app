import {
  labelOf,
  SCALAR_COLUMN,
  tableColumns,
  type AnswerValue,
  type Column,
  type QuestionNode,
} from '@kiosk/questionnaire';

/** What the Word file contains. Plain data: the caller reads it from wherever answers are kept. */
export interface QuestionnaireExport {
  title: string;
  /** Lines under the title: company, reporting period, source file, … */
  details: readonly string[];
  questions: readonly QuestionNode[];
  /** Columns of every table question, keyed by table id. */
  columns: Readonly<Record<string, Column[]>>;
  /** Current values by question id, then column key ("" outside tables). A missing cell is empty. */
  values: Readonly<Record<string, Readonly<Record<string, AnswerValue>>>>;
}

/**
 * One element of the document, independent of the Word format. The layout decides what the
 * document says; the renderer only decides how it looks.
 */
export type Block =
  | { kind: 'title'; text: string }
  | { kind: 'paragraph'; text: string }
  /** `level` starts at 1 for top-level questions. */
  | { kind: 'heading'; level: number; text: string }
  /** A question outside tables, written "label: value". */
  | { kind: 'answer'; label: string; value: string }
  /** `header` holds the column labels, each row starts with its question's label. */
  | { kind: 'table'; header: string[]; rows: string[][] };

/** Written in place of a question left unanswered. */
export const NOT_ANSWERED = 'Not answered';
/** Written in an empty table cell. */
export const EMPTY_CELL = '–';
/** Header of the first table column, which holds the row questions. */
const ROW_HEADER = 'Question';

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });

/** The questionnaire as a sequence of blocks: title, then each question in display order. */
export function layoutQuestionnaire(input: QuestionnaireExport): Block[] {
  return [
    { kind: 'title', text: input.title },
    ...input.details.map((text): Block => ({ kind: 'paragraph', text })),
    ...input.questions.flatMap((question) => layoutQuestion(input, question, 1)),
  ];
}

function layoutQuestion(
  input: QuestionnaireExport,
  question: QuestionNode,
  level: number,
): Block[] {
  switch (question.content) {
    case 'GROUP':
      return [
        { kind: 'heading', level, text: question.labelEn },
        ...question.children.flatMap((child) => layoutQuestion(input, child, level + 1)),
      ];
    case 'TABLE':
      return [{ kind: 'heading', level, text: question.labelEn }, layoutTable(input, question)];
    default:
      return [
        {
          kind: 'answer',
          label: labelOf(question),
          value: formatValue(valueOf(input, question.id, SCALAR_COLUMN.key)) ?? NOT_ANSWERED,
        },
      ];
  }
}

function layoutTable(input: QuestionnaireExport, table: QuestionNode): Block {
  const columns = tableColumns(input.columns, table.id);
  return {
    kind: 'table',
    header: [ROW_HEADER, ...columns.map((column) => column.label)],
    rows: table.children.map((row) => [
      labelOf(row),
      ...columns.map((column) => formatValue(valueOf(input, row.id, column.key)) ?? EMPTY_CELL),
    ]),
  };
}

function valueOf(input: QuestionnaireExport, questionId: string, columnKey: string): AnswerValue {
  return input.values[questionId]?.[columnKey] ?? null;
}

/** The value as written in the document, or `null` when it is empty. */
function formatValue(value: AnswerValue): string | null {
  if (typeof value === 'number') return numberFormat.format(value);
  const text = value?.trim() ?? '';
  return text === '' ? null : text;
}
