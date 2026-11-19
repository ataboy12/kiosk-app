'use server';

import 'server-only';

import { z } from 'zod';
import { OUT_OF_DATE, type AnswerEntry } from './answer-changes';
import { storeAnswers, type SaveResult } from './store-answers';

const saveInput = z.object({
  importId: z.uuid(),
  entries: z
    .array(
      z.object({
        questionId: z.string(),
        columnKey: z.string(),
        value: z.union([z.number(), z.string(), z.null()]),
      }),
    )
    .max(1000),
});

/**
 * Save button action: stores the cells the user changed. Never throws: a refused or failed save
 * returns a message, and the form keeps the user's values so they can try again.
 */
export async function saveAnswers(
  importId: string,
  entries: readonly AnswerEntry[],
): Promise<SaveResult> {
  const input = saveInput.safeParse({ importId, entries });
  if (!input.success) {
    return { ok: false, error: OUT_OF_DATE };
  }
  try {
    return await storeAnswers(input.data.importId, input.data.entries);
  } catch (error) {
    console.error(`Saving the answers of import ${importId} failed`, error);
    return { ok: false, error: 'Your answers could not be saved. Try again in a moment.' };
  }
}
