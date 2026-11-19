import { buildQuestionTree, type QuestionDefinition } from '@kiosk/questionnaire';
import { describe, expect, it } from 'vitest';
import type { PrefilledAnswer } from '~/prefill';
import { answerChanges } from './answer-changes';

function question(
  id: string,
  content: QuestionDefinition['content'],
  parentId: string | null,
  order: number,
  enumEn: string[] = [],
): QuestionDefinition {
  return {
    id,
    labelEn: id,
    labelFr: id,
    content,
    parentId,
    order,
    unit: null,
    enumEn,
    enumFr: [],
  };
}

const TREE = buildQuestionTree([
  question('S1-6_01', 'TABLE', null, 0),
  question('S1-6_03', 'NUMBER', 'S1-6_01', 0),
  question('S1-6_11', 'NUMBER', 'S1-6_01', 1),
  question('S1-6_12', 'NUMBER', 'S1-6_01', 2),
  question('S1-6_13', 'GROUP', null, 1),
  question('S1-6_14', 'ENUM', 'S1-6_13', 0, ['Head-count', 'Full-time equivalent']),
  question('S1-6_17', 'TEXT', 'S1-6_13', 1),
]);

const COLUMNS = { 'S1-6_01': [{ key: '', label: 'Total' }] };
const PROVENANCE = { method: 'Counted.', rubriques: [], notes: [] };

function stored(questionId: string, value: number | string): PrefilledAnswer {
  return {
    questionId,
    columnKey: '',
    computedValue: value,
    value,
    source: 'COMPUTED',
    provenance: PROVENANCE,
  };
}

const STORED = [stored('S1-6_03', 40), stored('S1-6_11', 2), stored('S1-6_12', 5)];

describe('answerChanges', () => {
  it('writes an edited input and the turnover recomputed from it, both MANUAL', () => {
    const result = answerChanges(TREE, COLUMNS, STORED, [
      { questionId: 'S1-6_11', columnKey: '', value: '4' },
    ]);
    expect(result).toEqual({
      ok: true,
      rows: [
        expect.objectContaining({
          questionId: 'S1-6_11',
          value: 4,
          computedValue: 2,
          source: 'MANUAL',
        }),
        expect.objectContaining({
          questionId: 'S1-6_12',
          value: 10,
          computedValue: 5,
          source: 'MANUAL',
        }),
      ],
    });
  });

  it('marks values set back to the computed ones COMPUTED again', () => {
    const edited: PrefilledAnswer[] = [
      stored('S1-6_03', 40),
      { ...stored('S1-6_11', 2), value: 4, source: 'MANUAL' },
      { ...stored('S1-6_12', 5), value: 10, source: 'MANUAL' },
    ];
    const result = answerChanges(TREE, COLUMNS, edited, [
      { questionId: 'S1-6_11', columnKey: '', value: 2 },
    ]);
    expect(result).toMatchObject({
      ok: true,
      rows: [
        { questionId: 'S1-6_11', value: 2, source: 'COMPUTED', provenance: PROVENANCE },
        { questionId: 'S1-6_12', value: 5, source: 'COMPUTED' },
      ],
    });
  });

  it('inserts a new manual answer, and skips empty ones (a blank number is empty)', () => {
    const result = answerChanges(
      TREE,
      COLUMNS,
      [],
      [
        { questionId: 'S1-6_17', columnKey: '', value: 'Matches the annual accounts.' },
        { questionId: 'S1-6_14', columnKey: '', value: '' },
        { questionId: 'S1-6_03', columnKey: '', value: '  ' },
      ],
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          questionId: 'S1-6_17',
          columnKey: '',
          computedValue: null,
          value: 'Matches the annual accounts.',
          source: 'MANUAL',
          provenance: null,
        },
      ],
    });
  });

  it('refuses values of the wrong type, unknown cells and derived answers', () => {
    const refuse = (questionId: string, columnKey: string, value: number | string) =>
      answerChanges(TREE, COLUMNS, STORED, [{ questionId, columnKey, value }]);
    expect(refuse('S1-6_11', '', 'many')).toEqual({
      ok: false,
      error: '“S1-6_11” must be a number.',
    });
    expect(refuse('S1-6_14', '', 'Both')).toMatchObject({
      ok: false,
      error: expect.stringContaining('one of'),
    });
    expect(refuse('S1-6_17', '', 3)).toMatchObject({ ok: false });
    expect(refuse('S1-6_11', '', '12abc')).toMatchObject({ ok: false });
    expect(refuse('S1-6_11', 'FR', 3)).toMatchObject({
      ok: false,
      error: expect.stringContaining('out of date'),
    });
    expect(refuse('S1-6_12', '', 3)).toMatchObject({ ok: false });
    expect(refuse('S1-6_01', '', 3)).toMatchObject({ ok: false });
  });
});
