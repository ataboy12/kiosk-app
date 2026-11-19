import 'server-only';

import { answers, dsnImports, eq, getDb, sql } from '@kiosk/db';
import { answerChanges, type AnswerEntry } from './answer-changes';
import { getQuestionTree } from './questions';

/** The answer columns the form reads (a `PrefilledAnswer`). */
export const ANSWER_FIELDS = {
  questionId: answers.questionId,
  columnKey: answers.columnKey,
  computedValue: answers.computedValue,
  value: answers.value,
  source: answers.source,
  provenance: answers.provenance,
};

export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Stores the cells the user changed, and the derived answers recomputed from them. The import row
 * is locked, so two saves of the same import (two tabs) apply one after the other.
 */
export async function storeAnswers(
  importId: string,
  entries: readonly AnswerEntry[],
): Promise<SaveResult> {
  const tree = await getQuestionTree();
  return getDb().transaction(async (tx): Promise<SaveResult> => {
    const [dsnImport] = await tx
      .select({ status: dsnImports.status, columns: dsnImports.columns })
      .from(dsnImports)
      .where(eq(dsnImports.id, importId))
      .for('update');
    if (!dsnImport) {
      return { ok: false, error: 'This import no longer exists. Upload your DSN again.' };
    }
    if (dsnImport.status !== 'READY') {
      return { ok: false, error: 'Your answers can be saved once your DSN has been read.' };
    }

    const stored = await tx
      .select(ANSWER_FIELDS)
      .from(answers)
      .where(eq(answers.importId, importId));
    const changes = answerChanges(tree, dsnImport.columns, stored, entries);
    if (!changes.ok) return changes;
    if (changes.rows.length > 0) {
      await tx
        .insert(answers)
        .values(changes.rows.map((row) => ({ ...row, importId })))
        .onConflictDoUpdate({
          target: [answers.importId, answers.questionId, answers.columnKey],
          set: { value: sql`excluded.value`, source: sql`excluded.source`, updatedAt: sql`now()` },
        });
    }
    return { ok: true };
  });
}
