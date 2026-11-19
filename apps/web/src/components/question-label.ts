import type { QuestionNode } from '@kiosk/questionnaire';

/** The question's label, with its unit when it has one: "Percentage of employee turnover (%)". */
export function labelOf(question: QuestionNode): string {
  return question.unit ? `${question.labelEn} (${question.unit})` : question.labelEn;
}
