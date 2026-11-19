import {
  buildQuestionTree,
  type QuestionContent,
  type QuestionDefinition,
} from '@kiosk/questionnaire';
import { describe, expect, it } from 'vitest';
import { buildQuestionnaireDocx } from './index';
import { EMPTY_CELL, layoutQuestionnaire, NOT_ANSWERED, type QuestionnaireExport } from './layout';

function question(
  id: string,
  content: QuestionContent,
  parentId: string | null,
  order: number,
  extra: Partial<QuestionDefinition> = {},
): QuestionDefinition {
  const base = { labelEn: `${id} label`, labelFr: id, unit: null, enumEn: [], enumFr: [] };
  return { id, content, parentId, order, ...base, ...extra };
}

const QUESTIONS = buildQuestionTree([
  question('T', 'TABLE', null, 0, { labelEn: 'By contract' }),
  question('T1', 'NUMBER', 'T', 0, { labelEn: 'Head-count' }),
  question('T2', 'NUMBER', 'T', 1, { labelEn: 'Turnover', unit: '%' }),
  question('G', 'GROUP', null, 1, { labelEn: 'Context' }),
  question('G1', 'ENUM', 'G', 0, { labelEn: 'Unit', enumEn: ['Head-count', 'FTE'] }),
  question('G2', 'TEXT', 'G', 1, { labelEn: 'Notes' }),
  question('S', 'GROUP', 'G', 2, { labelEn: 'Sub-section' }),
  question('S1', 'NUMBER', 'S', 0, { labelEn: 'Deep' }),
]);

function exportOf(overrides: Partial<QuestionnaireExport> = {}): QuestionnaireExport {
  return {
    title: 'Workforce',
    details: ['ACME', 'November 2025'],
    questions: QUESTIONS,
    columns: {
      T: [
        { key: 'P', label: 'Permanent' },
        { key: 'F', label: 'Fixed-term' },
      ],
    },
    values: {
      T1: { P: 1234, F: 5 },
      T2: { P: 12.345 },
      G1: { '': 'Head-count' },
      G2: { '': '  ' },
    },
    ...overrides,
  };
}

describe('layoutQuestionnaire', () => {
  it('writes the title and details, then each question in display order', () => {
    expect(layoutQuestionnaire(exportOf())).toEqual([
      { kind: 'title', text: 'Workforce' },
      { kind: 'paragraph', text: 'ACME' },
      { kind: 'paragraph', text: 'November 2025' },
      { kind: 'heading', level: 1, text: 'By contract' },
      {
        kind: 'table',
        header: ['Question', 'Permanent', 'Fixed-term'],
        rows: [
          ['Head-count', '1,234', '5'],
          ['Turnover (%)', '12.35', EMPTY_CELL],
        ],
      },
      { kind: 'heading', level: 1, text: 'Context' },
      { kind: 'answer', label: 'Unit', value: 'Head-count' },
      { kind: 'answer', label: 'Notes', value: NOT_ANSWERED },
      { kind: 'heading', level: 2, text: 'Sub-section' },
      { kind: 'answer', label: 'Deep', value: NOT_ANSWERED },
    ]);
  });

  it('gives a table the mapping did not see a single "Total" column', () => {
    const blocks = layoutQuestionnaire(exportOf({ columns: {}, values: { T1: { '': 0 } } }));
    expect(blocks.find((block) => block.kind === 'table')).toEqual({
      kind: 'table',
      header: ['Question', 'Total'],
      rows: [
        ['Head-count', '0'],
        ['Turnover (%)', EMPTY_CELL],
      ],
    });
  });
});

describe('buildQuestionnaireDocx', () => {
  it('packs the document as a .docx (zip) file', async () => {
    const values = { G2: { '': 'First line\nSecond line' } };
    const file = new Uint8Array(await buildQuestionnaireDocx(exportOf({ values })));
    expect(String.fromCharCode(...file.subarray(0, 2))).toBe('PK');
  });
});
