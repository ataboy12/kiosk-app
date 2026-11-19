'use client';

import type { Column } from '@kiosk/questionnaire';
import { createContext, use, type Dispatch } from 'react';
import type { FormAction, FormState } from '~/form-state';

/*
 * Two contexts: the values change on every keystroke, the rest only when the answers arrive. Inputs
 * read only the stable one and get their cell's value as props, so an edit re-renders one input.
 */

/** The pre-fill state of each question, and how to change the values. Stable while editing. */
export interface AnswerFormContextValue {
  dispatch: Dispatch<FormAction>;
  /** Questions the DSN answers are locked until their answers arrive. */
  isLocked: (questionId: string) => boolean;
  /** Why the DSN couldn't answer a question it should have, or `undefined`. */
  failureOf: (questionId: string) => string | undefined;
  /** A table's columns, or `null` while they are being computed from the DSN. */
  columnsOf: (tableId: string) => Column[] | null;
}

export const AnswerFormContext = createContext<AnswerFormContextValue | null>(null);

export const FormStateContext = createContext<FormState | null>(null);

export function useAnswerForm(): AnswerFormContextValue {
  const form = use(AnswerFormContext);
  if (!form) throw new Error('useAnswerForm must be used inside an AnswerFormContext.');
  return form;
}

export function useFormState(): FormState {
  const state = use(FormStateContext);
  if (!state) throw new Error('useFormState must be used inside a FormStateContext.');
  return state;
}
