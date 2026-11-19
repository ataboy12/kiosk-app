import type { AnswerValue, Provenance } from '@kiosk/questionnaire';
import {
  cellOf,
  cellsOf,
  DERIVED_QUESTION_IDS,
  withCell,
  withDerived,
  type AnswerGrid,
} from './answer-grid';
import type { PrefilledAnswer } from './prefill';

/*
 * The form's state, as a pure reducer so it can be tested without rendering. Number inputs may
 * hold a partly typed number ("1.") as a string; the save action reads it as a number.
 */

/** A value computed from the DSN, kept so an edited cell can be reset. */
export interface ComputedCell {
  value: AnswerValue;
  provenance: Provenance;
}

export interface FormState {
  /** What the user sees. */
  values: AnswerGrid;
  /** Values as last loaded or saved: a cell that differs has an unsaved change. */
  saved: AnswerGrid;
  computed: AnswerGrid<ComputedCell>;
}

export const EMPTY_FORM: FormState = { values: {}, saved: {}, computed: {} };

export type FormAction =
  /** The stored answers arrived (pre-filled and previously saved). */
  | { type: 'loaded'; answers: readonly PrefilledAnswer[] }
  | { type: 'edited'; questionId: string; columnKey: string; value: AnswerValue }
  | { type: 'reset'; questionId: string; columnKey: string }
  /** `values` were saved: the ones sent, so edits made while saving stay unsaved. */
  | { type: 'saved'; values: AnswerGrid };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'loaded':
      return load(state, action.answers);
    case 'edited':
      return edit(state, action.questionId, action.columnKey, action.value);
    case 'reset': {
      const computed = cellOf(state.computed, action.questionId, action.columnKey);
      return computed ? edit(state, action.questionId, action.columnKey, computed.value) : state;
    }
    case 'saved':
      return { ...state, saved: action.values };
  }
}

function edit(state: FormState, questionId: string, columnKey: string, value: AnswerValue) {
  return { ...state, values: withDerived(withCell(state.values, questionId, columnKey, value)) };
}

/** Takes the stored answers, but keeps what the user typed while waiting for them. */
function load(state: FormState, answers: readonly PrefilledAnswer[]): FormState {
  let { values, saved, computed } = state;
  for (const answer of answers) {
    const { questionId, columnKey } = answer;
    if (!hasUnsavedChange(state, questionId, columnKey)) {
      values = withCell(values, questionId, columnKey, answer.value);
    }
    saved = withCell(saved, questionId, columnKey, answer.value);
    if (answer.provenance !== null) {
      computed = withCell(computed, questionId, columnKey, {
        value: answer.computedValue,
        provenance: answer.provenance,
      });
    }
  }
  return { values: withDerived(values), saved, computed };
}

export function valueOf(state: FormState, questionId: string, columnKey: string): AnswerValue {
  return cellOf(state.values, questionId, columnKey) ?? null;
}

function hasUnsavedChange(state: FormState, questionId: string, columnKey: string): boolean {
  return (
    valueOf(state, questionId, columnKey) !== (cellOf(state.saved, questionId, columnKey) ?? null)
  );
}

/**
 * The cells to send when saving. Derived answers are left out: the server recomputes them from
 * their inputs.
 */
export function unsavedChanges(state: FormState) {
  return cellsOf(state.values).filter(
    ({ questionId, columnKey }) =>
      !DERIVED_QUESTION_IDS.has(questionId) && hasUnsavedChange(state, questionId, columnKey),
  );
}

/** The DSN's value for this cell when the user changed it, otherwise `undefined`. */
export function editedFrom(
  state: FormState,
  questionId: string,
  columnKey: string,
): ComputedCell | undefined {
  const computed = cellOf(state.computed, questionId, columnKey);
  return computed && computed.value !== valueOf(state, questionId, columnKey)
    ? computed
    : undefined;
}

/** What one input needs from the state: its value, and the DSN's value when it was edited. */
export function cellState(state: FormState, questionId: string, columnKey: string) {
  return {
    value: valueOf(state, questionId, columnKey),
    edited: editedFrom(state, questionId, columnKey),
  };
}

/**
 * Where a question's answer comes from, shown beside it: as computed from the DSN, changed or
 * added by the user, or still empty.
 */
export type AnswerStatus = 'computed' | 'yours' | 'missing';

export function answerStatus(state: FormState, questionId: string): AnswerStatus {
  const row = state.values[questionId] ?? {};
  const filled = Object.values(row).some((value) => value !== null && value !== '');
  if (!filled) return 'missing';
  const computed = state.computed[questionId] !== undefined;
  const edited = Object.keys(row).some((columnKey) => editedFrom(state, questionId, columnKey));
  return computed && !edited ? 'computed' : 'yours';
}

/** How the DSN answered this question (the same for all its columns), or `undefined`. */
export function provenanceOf(state: FormState, questionId: string): Provenance | undefined {
  return Object.values(state.computed[questionId] ?? {})[0]?.provenance;
}
