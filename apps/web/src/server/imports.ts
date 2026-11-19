import 'server-only';

import { answers, dsnImports, eq, getDb, sql, type DsnImport } from '@kiosk/db';
import {
  SUMMARY_WARNING_LIMIT,
  type Prefill,
  type PrefilledAnswer,
  type PrefillSummary,
} from '~/prefill';
import { ANSWER_FIELDS } from './store-answers';
import { computeImport } from './compute-import';
import { getQuestionTree } from './questions';
import { settle } from './settle';

/**
 * Past this, the page stops waiting and offers a retry; the processing itself carries on. A call
 * waiting for another call's lock gives up after the same delay, so it frees its connection.
 */
const PROCESSING_TIMEOUT_MS = 30_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The import's file name, or `null` when there is no import with this id. */
export async function getImport(id: string) {
  if (!UUID.test(id)) return null;
  const [row] = await getDb()
    .select({ fileName: dsnImports.fileName })
    .from(dsnImports)
    .where(eq(dsnImports.id, id));
  return row ?? null;
}

/** Stores an uploaded file as a new import, still to be processed. Returns its id. */
export async function createImport(fileName: string, content: string): Promise<string> {
  const [row] = await getDb()
    .insert(dsnImports)
    .values({ fileName, content })
    .returning({ id: dsnImports.id });
  if (!row) throw new Error('The import was not created.');
  return row.id;
}

/**
 * Processes the import if it hasn't been yet, and returns its pre-filled answers. Safe to call
 * again: a processed import is read back, never recomputed. This is the one entry point to the
 * processing, so it can move to a background job without changing the page.
 *
 * Never rejects: a slow or failing run resolves to `RETRY`, which the page offers to retry.
 */
export function processImport(id: string): Promise<Prefill> {
  return settle(
    () => runOnce(id).then(() => readPrefill(id)),
    PROCESSING_TIMEOUT_MS,
    (error) => console.error(`Processing import ${id} failed`, error),
  );
}

/**
 * Computes and stores the answers of an import still PROCESSING. The row lock makes concurrent
 * calls (a refresh, two tabs) wait for the first one, which then finds the import processed.
 */
async function runOnce(id: string): Promise<void> {
  // Most visits are to a processed import: check without taking the lock.
  const [current] = await getDb()
    .select({ status: dsnImports.status })
    .from(dsnImports)
    .where(eq(dsnImports.id, id));
  if (current?.status !== 'PROCESSING') return;

  const tree = await getQuestionTree();
  await getDb().transaction(async (tx) => {
    await tx.execute(sql.raw(`set local lock_timeout = ${PROCESSING_TIMEOUT_MS}`));
    const [dsnImport] = await tx
      .select({ status: dsnImports.status, content: dsnImports.content })
      .from(dsnImports)
      .where(eq(dsnImports.id, id))
      .for('update');
    if (dsnImport?.status !== 'PROCESSING') return;

    const computed = computeImport(dsnImport.content, tree);
    if (computed.answers.length > 0) {
      await tx
        .insert(answers)
        .values(computed.answers.map((answer) => ({ ...answer, importId: id })));
    }
    await tx.update(dsnImports).set(computed.update).where(eq(dsnImports.id, id));
  });
}

async function readPrefill(id: string): Promise<Prefill> {
  const db = getDb();
  const [dsnImport] = await db.select().from(dsnImports).where(eq(dsnImports.id, id));
  if (!dsnImport) throw new Error(`Import ${id} does not exist.`);
  if (dsnImport.status === 'FAILED') {
    return { status: 'FAILED', message: dsnImport.error ?? 'This DSN could not be read.' };
  }
  if (dsnImport.status === 'PROCESSING') throw new Error(`Import ${id} is still processing.`);

  const rows = await db.select(ANSWER_FIELDS).from(answers).where(eq(answers.importId, id));

  return {
    status: 'READY',
    summary: summarise(dsnImport, rows),
    columns: dsnImport.columns,
    answers: rows,
    failures: dsnImport.failures,
  };
}

function summarise(dsnImport: DsnImport, rows: readonly PrefilledAnswer[]): PrefillSummary {
  const { periodStart, periodEnd } = dsnImport;
  return {
    employeeCount: dsnImport.employeeCount ?? 0,
    prefilledCount: new Set(rows.filter((r) => r.provenance !== null).map((r) => r.questionId))
      .size,
    period: periodStart && periodEnd ? { start: periodStart, end: periodEnd } : null,
    warnings: dsnImport.warnings.slice(0, SUMMARY_WARNING_LIMIT),
    warningCount: dsnImport.warnings.length,
  };
}
