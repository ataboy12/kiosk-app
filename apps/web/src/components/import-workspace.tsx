'use client';

import type { QuestionNode } from '@kiosk/questionnaire';
import { Stack } from '@mantine/core';
import { Suspense, useState } from 'react';
import type { Prefill } from '~/prefill';
import { PrefillStatus, WaitingBanner } from './prefill-status';
import { QuestionOutline } from './question-outline';

interface ImportWorkspaceProps {
  questions: QuestionNode[];
  /** Questions the DSN can answer: locked until `prefill` resolves. */
  mappedQuestionIds: string[];
  /** Resolves once the DSN is processed; streamed from the server. */
  prefill: Promise<Prefill>;
}

/**
 * The questions render at once; the pre-filled answers arrive later through `prefill`. Only the
 * status banner suspends, so the rest of the page stays usable while the DSN is read.
 */
export function ImportWorkspace({ questions, mappedQuestionIds, prefill }: ImportWorkspaceProps) {
  const [settled, setSettled] = useState<Prefill | null>(null);

  return (
    <Stack gap="lg">
      <div role="status" aria-live="polite">
        <Suspense fallback={<WaitingBanner />}>
          <PrefillStatus prefill={prefill} onSettled={setSettled} />
        </Suspense>
      </div>
      <QuestionOutline
        questions={questions}
        mappedQuestionIds={mappedQuestionIds}
        prefill={settled}
      />
    </Stack>
  );
}
