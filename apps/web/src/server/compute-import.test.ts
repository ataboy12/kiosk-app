import { readFileSync } from 'node:fs';
import { buildQuestionTree, type QuestionDefinition } from '@kiosk/questionnaire';
import { describe, expect, it } from 'vitest';
import { computeImport } from './compute-import';

function question(
  id: string,
  content: QuestionDefinition['content'],
  parentId: string | null,
  order: number,
): QuestionDefinition {
  return {
    id,
    labelEn: id,
    labelFr: id,
    content,
    parentId,
    order,
    unit: null,
    enumEn: [],
    enumFr: [],
  };
}

// The "Global employees" table of questions.csv, and one question the DSN doesn't answer.
const TREE = buildQuestionTree([
  question('S1-6_01', 'TABLE', null, 0),
  question('S1-6_02', 'NUMBER', 'S1-6_01', 0),
  question('S1-6_03', 'NUMBER', 'S1-6_01', 1),
  question('S1-6_11', 'NUMBER', 'S1-6_01', 2),
  question('S1-6_12', 'NUMBER', 'S1-6_01', 3),
  question('S1-6_17', 'TEXT', null, 1),
]);

const SAMPLE = readFileSync(new URL('../../../../dsn.txt', import.meta.url), 'utf8');

describe('computeImport', () => {
  it('marks the sample READY and stores one computed answer per mapped question', () => {
    const { update, answers } = computeImport(SAMPLE, TREE);
    expect(update).toMatchObject({
      status: 'READY',
      error: null,
      employeeCount: 100,
      periodStart: '2025-11-01',
      periodEnd: '2025-12-31',
      failures: [],
    });
    expect(answers.map((a) => a.questionId)).toEqual(['S1-6_02', 'S1-6_03', 'S1-6_11', 'S1-6_12']);
    expect(answers[0]).toMatchObject({
      columnKey: '',
      computedValue: 100,
      value: 100,
      source: 'COMPUTED',
      provenance: { rubriques: expect.arrayContaining(['S21.G00.30.001']) },
    });
  });

  it('marks a file the parser rejects FAILED with its message, and stores no answer', () => {
    const { update, answers } = computeImport("S10.G00.00.001,'Paie'", TREE);
    expect(update).toMatchObject({ status: 'FAILED', error: expect.stringContaining('DSN') });
    expect(answers).toEqual([]);
  });
});
