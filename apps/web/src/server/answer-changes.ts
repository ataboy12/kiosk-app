import type { AnswerSource, NewAnswer } from '@kiosk/db';
import {
  flattenQuestions,
  SCALAR_COLUMN,
  tableColumns,
  type AnswerValue,
  type Column,
  type QuestionNode,
} from '@kiosk/questionnaire';
import {
  cellOf,
  cellsOf,
  DERIVED_QUESTION_IDS,
  MAX_TEXT_LENGTH,
  readNumber,
  withCell,
  withDerived,
  type AnswerGrid,
} from '~/answer-grid';
import type { PrefilledAnswer } from '~/prefill';

/** One cell the user changed, as sent by the form. */
export interface AnswerEntry {
  questionId: string;
  columnKey: string;
  value: AnswerValue;
}

export type AnswerChanges =
  { ok: true; rows: Omit<NewAnswer, 'importId'>[] } | { ok: false; error: string };

/** The form's cells no longer match the questions or the import: the page must be reloaded. */
export const OUT_OF_DATE = 'The form is out of date. Reload the page and try again.';

const ANSWERABLE = new Set(['NUMBER', 'TEXT', 'ENUM']);

/**
 * Checks the cells sent by the form against the questions and the import's columns, then returns
 * the rows to write: the changed cells and the derived answers recomputed from them. Each row
 * keeps its computed value and provenance, and is COMPUTED only while it still equals them.
 */
export function answerChanges(
  tree: readonly QuestionNode[],
  columns: Readonly<Record<string, Column[]>>,
  stored: readonly PrefilledAnswer[],
  entries: readonly AnswerEntry[],
): AnswerChanges {
  const answerable = answerableCells(tree, columns);
  const storedByCell = stored.reduce<AnswerGrid<PrefilledAnswer>>(
    (grid, answer) => withCell(grid, answer.questionId, answer.columnKey, answer),
    {},
  );

  let values: AnswerGrid = stored.reduce<AnswerGrid>(
    (grid, answer) => withCell(grid, answer.questionId, answer.columnKey, answer.value),
    {},
  );
  for (const entry of entries) {
    const cell = answerable.get(entry.questionId);
    if (!cell?.columnKeys.includes(entry.columnKey)) {
      return { ok: false, error: OUT_OF_DATE };
    }
    const value = readValue(cell.question, entry.value);
    if (!value.ok) return value;
    values = withCell(values, entry.questionId, entry.columnKey, value.value);
  }

  const rows = cellsOf(withDerived(values)).flatMap(({ questionId, columnKey, value }) => {
    const before = cellOf(storedByCell, questionId, columnKey);
    const unchanged = before ? value === before.value : value === null;
    if (unchanged) return [];
    const computedValue = before?.computedValue ?? null;
    const provenance = before?.provenance ?? null;
    const source: AnswerSource =
      provenance !== null && value === computedValue ? 'COMPUTED' : 'MANUAL';
    return [{ questionId, columnKey, computedValue, value, source, provenance }];
  });
  return { ok: true, rows };
}

/** The questions the user can answer, with their column keys. */
function answerableCells(
  tree: readonly QuestionNode[],
  columns: Readonly<Record<string, Column[]>>,
) {
  const questions = flattenQuestions(tree);
  const tableIds = new Set(questions.filter((q) => q.content === 'TABLE').map((q) => q.id));
  const cells = new Map<string, { question: QuestionNode; columnKeys: string[] }>();
  for (const question of questions) {
    if (!ANSWERABLE.has(question.content) || DERIVED_QUESTION_IDS.has(question.id)) continue;
    const { parentId } = question;
    const questionColumns =
      parentId !== null && tableIds.has(parentId)
        ? tableColumns(columns, parentId)
        : [SCALAR_COLUMN];
    cells.set(question.id, { question, columnKeys: questionColumns.map((c) => c.key) });
  }
  return cells;
}

/** The value to store for `question`: a number typed as text becomes a number, "" is empty. */
function readValue(
  question: QuestionNode,
  value: AnswerValue,
): { ok: true; value: AnswerValue } | { ok: false; error: string } {
  if (value === null || value === '') return { ok: true, value: null };
  const label = `“${question.labelEn}”`;
  switch (question.content) {
    case 'NUMBER': {
      const number = readNumber(value);
      return number === undefined
        ? { ok: false, error: `${label} must be a number.` }
        : { ok: true, value: number };
    }
    case 'ENUM':
      return typeof value === 'string' && question.enumEn.includes(value)
        ? { ok: true, value }
        : { ok: false, error: `${label} must be one of: ${question.enumEn.join(', ')}.` };
    default: // TEXT: `answerableCells` keeps only number, enum and text questions.
      if (typeof value !== 'string') return { ok: false, error: `${label} must be a text.` };
      return value.length <= MAX_TEXT_LENGTH
        ? { ok: true, value }
        : { ok: false, error: `${label} is longer than ${MAX_TEXT_LENGTH} characters.` };
  }
}
