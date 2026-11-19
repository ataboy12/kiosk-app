'use client';

import { tableColumns, type QuestionNode } from '@kiosk/questionnaire';
import { Stack } from '@mantine/core';
import { Suspense, useCallback, useMemo, useReducer, useState } from 'react';
import { EMPTY_FORM, formReducer } from '~/form-state';
import type { Prefill } from '~/prefill';
import { StatusLegend } from './annotated';
import { AnswerForm } from './answer-form';
import {
  AnswerFormContext,
  FormStateContext,
  type AnswerFormContextValue,
} from './answer-form-context';
import { PrefillStatus, WaitingBanner } from './prefill-status';
import { SaveBar } from './save-bar';

interface ImportWorkspaceProps {
  importId: string;
  questions: QuestionNode[];
  /** Questions the DSN can answer: locked until `prefill` resolves. */
  mappedQuestionIds: string[];
  /** Resolves once the DSN is processed; streamed from the server. */
  prefill: Promise<Prefill>;
}

/**
 * The form renders at once; the pre-filled answers arrive later through `prefill`. Only the
 * status banner suspends, so the rest of the page stays usable while the DSN is read.
 */
export function ImportWorkspace({
  importId,
  questions,
  mappedQuestionIds,
  prefill,
}: ImportWorkspaceProps) {
  const [settled, setSettled] = useState<Prefill | null>(null);
  const [state, dispatch] = useReducer(formReducer, EMPTY_FORM);

  const onSettled = useCallback((result: Prefill) => {
    setSettled(result);
    if (result.status === 'READY') dispatch({ type: 'loaded', answers: result.answers });
  }, []);

  const mapped = useMemo(() => new Set(mappedQuestionIds), [mappedQuestionIds]);
  // Changes only when the answers arrive, never while editing (see answer-form-context.tsx).
  const form = useMemo((): AnswerFormContextValue => {
    const ready = settled?.status === 'READY' ? settled : null;
    return {
      dispatch,
      // On RETRY the computation may still finish, so mapped questions stay locked until it has.
      isLocked: (questionId) => ready === null && mapped.has(questionId),
      failureOf: (questionId) => ready?.failures.find((f) => f.questionId === questionId)?.message,
      columnsOf: (tableId) => (ready ? tableColumns(ready.columns, tableId) : null),
    };
  }, [settled, mapped]);

  return (
    <Stack gap="lg">
      <div role="status" aria-live="polite">
        <Suspense fallback={<WaitingBanner />}>
          <PrefillStatus prefill={prefill} onSettled={onSettled} />
        </Suspense>
      </div>
      {/* A file that isn't a usable DSN has nothing to answer: the banner offers a new upload. */}
      {settled?.status !== 'FAILED' && (
        <AnswerFormContext value={form}>
          <FormStateContext value={state}>
            <StatusLegend />
            <AnswerForm questions={questions} />
            <SaveBar importId={importId} ready={settled?.status === 'READY'} />
          </FormStateContext>
        </AnswerFormContext>
      )}
    </Stack>
  );
}
