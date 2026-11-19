import 'server-only';

import { answers, dsnImports, eq, getDb } from '@kiosk/db';
import { buildQuestionnaireDocx } from '@kiosk/docx-export';
import { withCell, type AnswerGrid } from '~/answer-grid';
import { QUESTIONNAIRE_TITLE } from '~/questionnaire-title';
import { attachmentHeader, exportDetails } from './export-metadata';
import { isImportId } from './imports';
import { getQuestionTree } from './questions';

export interface ExportedFile {
  /** The `Content-Disposition` header, named after the uploaded file. */
  disposition: string;
  content: ArrayBuffer;
}

/**
 * The saved answers of a processed import as a Word file, or `null` when there is no processed
 * import with this id. Unsaved changes in the browser are not included.
 */
export async function exportImport(id: string): Promise<ExportedFile | null> {
  if (!isImportId(id)) return null;
  const db = getDb();
  // Not `select()`: the import row also holds the whole uploaded file.
  const [dsnImport] = await db
    .select({
      status: dsnImports.status,
      fileName: dsnImports.fileName,
      companyName: dsnImports.companyName,
      siren: dsnImports.siren,
      periodStart: dsnImports.periodStart,
      periodEnd: dsnImports.periodEnd,
      columns: dsnImports.columns,
    })
    .from(dsnImports)
    .where(eq(dsnImports.id, id));
  if (dsnImport?.status !== 'READY') return null;

  const [questions, rows] = await Promise.all([
    getQuestionTree(),
    db
      .select({
        questionId: answers.questionId,
        columnKey: answers.columnKey,
        value: answers.value,
      })
      .from(answers)
      .where(eq(answers.importId, id)),
  ]);
  const values = rows.reduce<AnswerGrid>(
    (grid, row) => withCell(grid, row.questionId, row.columnKey, row.value),
    {},
  );

  const content = await buildQuestionnaireDocx({
    title: QUESTIONNAIRE_TITLE,
    details: exportDetails(dsnImport),
    questions,
    columns: dsnImport.columns,
    values,
  });
  return { disposition: attachmentHeader(dsnImport.fileName), content };
}
