import {
  DERIVED_ANSWERS,
  SCALAR_COLUMN,
  type AnswerValue,
  type Column,
} from '@kiosk/questionnaire';

/*
 * Answer rules shared by the form (in the browser) and the save action (on the server), so both
 * agree on a table's columns and on the derived answers.
 */

/** Longest text answer accepted. */
export const MAX_TEXT_LENGTH = 10_000;

/** Values by question id, then by column key ("" outside tables). Sparse: a missing cell is empty. */
export type AnswerGrid<T = AnswerValue> = Readonly<Record<string, Readonly<Record<string, T>>>>;

export function cellOf<T>(
  grid: AnswerGrid<T>,
  questionId: string,
  columnKey: string,
): T | undefined {
  return grid[questionId]?.[columnKey];
}

/** A copy of `grid` with one cell set. */
export function withCell<T>(
  grid: AnswerGrid<T>,
  questionId: string,
  columnKey: string,
  value: T,
): AnswerGrid<T> {
  return { ...grid, [questionId]: { ...grid[questionId], [columnKey]: value } };
}

/** Every cell of `grid`, in insertion order. */
export function cellsOf<T>(grid: AnswerGrid<T>) {
  return Object.entries(grid).flatMap(([questionId, row]) =>
    Object.entries(row).map(([columnKey, value]) => ({ questionId, columnKey, value })),
  );
}

/** Questions computed from other answers: the user edits their inputs, never them. */
export const DERIVED_QUESTION_IDS: ReadonlySet<string> = new Set(
  DERIVED_ANSWERS.map((derived) => derived.questionId),
);

/**
 * Recomputes every derived answer, in each column where one of its inputs has a value, with the
 * same `compute` the mapping engine uses.
 */
export function withDerived(values: AnswerGrid): AnswerGrid {
  let result = values;
  for (const derived of DERIVED_ANSWERS) {
    const columnKeys = new Set(derived.inputIds.flatMap((id) => Object.keys(result[id] ?? {})));
    for (const columnKey of columnKeys) {
      const inputs = derived.inputIds.map((id) => cellOf(result, id, columnKey) ?? null);
      result = withCell(result, derived.questionId, columnKey, derived.compute(inputs));
    }
  }
  return result;
}

/**
 * A number field's value as a number: blank is empty (`null`), and text that isn't a number is
 * `undefined`. The form reads a partly typed number with it, and the server every number sent.
 */
export function readNumber(value: AnswerValue): number | null | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value === null || value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

/** A table's columns, as found in the DSN. A table the mapping didn't see has a single column. */
export function tableColumns(
  columns: Readonly<Record<string, Column[]>>,
  tableId: string,
): Column[] {
  return columns[tableId] ?? [SCALAR_COLUMN];
}
