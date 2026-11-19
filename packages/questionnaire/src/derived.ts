import type { AnswerValue } from './types';

/**
 * An answer computed from other answers of the same table column, not from the DSN. The engine
 * applies it to the computed inputs, and the form applies the same `compute` when the user edits
 * an input, so both always agree.
 */
export interface DerivedAnswer {
  questionId: string;
  inputIds: string[];
  /** Plain-language description, shown as the answer's provenance. */
  method: string;
  /** Receives the inputs' values in `inputIds` order. */
  compute: (inputs: readonly AnswerValue[]) => AnswerValue;
}

/** Leavers ÷ average head-count × 100, rounded to one decimal. `null` when it can't be computed. */
export function turnoverRate(leaverCount: AnswerValue, average: AnswerValue): number | null {
  if (typeof leaverCount !== 'number' || typeof average !== 'number' || average <= 0) return null;
  return Math.round((leaverCount / average) * 1000) / 10;
}

export const DERIVED_ANSWERS: readonly DerivedAnswer[] = [
  {
    questionId: 'S1-6_12',
    inputIds: ['S1-6_11', 'S1-6_03'],
    method: 'Leavers ÷ average head-count × 100, rounded to one decimal.',
    compute: ([leaverCount = null, average = null]) => turnoverRate(leaverCount, average),
  },
];
