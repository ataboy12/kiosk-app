import { describe, expect, it } from 'vitest';
import {
  answerStatus,
  EMPTY_FORM,
  editedFrom,
  formReducer,
  unsavedChanges,
  valueOf,
  type FormAction,
  type FormState,
} from './form-state';
import type { PrefilledAnswer } from './prefill';

const PROVENANCE = { method: 'Counted.', rubriques: ['S21.G00.30.001'], notes: [] };

function computed(questionId: string, value: number | string): PrefilledAnswer {
  return {
    questionId,
    columnKey: '',
    computedValue: value,
    value,
    source: 'COMPUTED',
    provenance: PROVENANCE,
  };
}

// Leavers, average head-count and turnover (derived from both) of the "Global employees" table.
const LOADED: FormAction = {
  type: 'loaded',
  answers: [computed('S1-6_11', 2), computed('S1-6_03', 40), computed('S1-6_12', 5)],
};

function run(...actions: FormAction[]): FormState {
  return actions.reduce(formReducer, EMPTY_FORM);
}

function edit(questionId: string, value: number | string | null): FormAction {
  return { type: 'edited', questionId, columnKey: '', value };
}

describe('formReducer', () => {
  it('loads the stored answers with nothing to save', () => {
    const state = run(LOADED);
    expect(valueOf(state, 'S1-6_11', '')).toBe(2);
    expect(unsavedChanges(state)).toEqual([]);
    expect(editedFrom(state, 'S1-6_11', '')).toBeUndefined();
  });

  it('recomputes turnover when an input is edited, and marks the input edited', () => {
    const state = run(LOADED, edit('S1-6_11', 4));
    expect(valueOf(state, 'S1-6_12', '')).toBe(10);
    expect(editedFrom(state, 'S1-6_11', '')).toMatchObject({ value: 2 });
    // Turnover is recomputed by the server, so only the input is sent.
    expect(unsavedChanges(state)).toEqual([{ questionId: 'S1-6_11', columnKey: '', value: 4 }]);
  });

  it('resets an edited cell to its computed value', () => {
    const state = run(LOADED, edit('S1-6_11', 4), {
      type: 'reset',
      questionId: 'S1-6_11',
      columnKey: '',
    });
    expect(valueOf(state, 'S1-6_11', '')).toBe(2);
    expect(valueOf(state, 'S1-6_12', '')).toBe(5);
    expect(unsavedChanges(state)).toEqual([]);
  });

  it('keeps what the user typed before the answers arrived', () => {
    const state = run(edit('S1-6_17', 'Typed while waiting'), {
      type: 'loaded',
      answers: [{ ...computed('S1-6_17', 'Saved earlier'), provenance: null, source: 'MANUAL' }],
    });
    expect(valueOf(state, 'S1-6_17', '')).toBe('Typed while waiting');
    expect(unsavedChanges(state)).toHaveLength(1);
  });

  it('keeps edits made while saving unsaved', () => {
    const typed = run(LOADED, edit('S1-6_11', 4));
    const saved: FormAction = { type: 'saved', values: typed.values };
    const state = [edit('S1-6_11', 6), saved].reduce(formReducer, typed);
    expect(unsavedChanges(state)).toEqual([{ questionId: 'S1-6_11', columnKey: '', value: 6 }]);
    expect(unsavedChanges(formReducer(typed, saved))).toEqual([]);
  });
});

describe('answerStatus', () => {
  it('is computed while the DSN value is kept', () => {
    expect(answerStatus(run(LOADED), 'S1-6_11')).toBe('computed');
  });

  it("is the user's once a computed value is changed, and computed again after a reset", () => {
    const edited = run(LOADED, edit('S1-6_11', 4));
    expect(answerStatus(edited, 'S1-6_11')).toBe('yours');
    const reset: FormAction = { type: 'reset', questionId: 'S1-6_11', columnKey: '' };
    expect(answerStatus(formReducer(edited, reset), 'S1-6_11')).toBe('computed');
  });

  it("is the user's for an answer the DSN doesn't give, and missing while it is empty", () => {
    expect(answerStatus(run(LOADED), 'S1-6_17')).toBe('missing');
    expect(answerStatus(run(LOADED, edit('S1-6_17', 'See note 4')), 'S1-6_17')).toBe('yours');
    expect(answerStatus(run(LOADED, edit('S1-6_17', '')), 'S1-6_17')).toBe('missing');
  });
});
