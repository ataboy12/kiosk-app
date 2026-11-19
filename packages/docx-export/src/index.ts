import { layoutQuestionnaire, type QuestionnaireExport } from './layout';
import { renderDocx } from './render';

export type { QuestionnaireExport } from './layout';

/** The filled questionnaire as a Word file: title, sections as headings, tables as Word tables. */
export function buildQuestionnaireDocx(input: QuestionnaireExport): Promise<ArrayBuffer> {
  return renderDocx(input.title, layoutQuestionnaire(input));
}
