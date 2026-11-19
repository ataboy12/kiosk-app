import { readFileSync } from 'node:fs';
import { parseDsn } from '@kiosk/dsn';
import { describe, expect, it } from 'vitest';
import { MAPPED_QUESTION_IDS, mapDsn } from './map-dsn';
import { buildQuestionTree } from './question-tree';
import { DERIVED_ANSWERS, turnoverRate } from './derived';
import { dsnOf, establishment, question, S1_6_QUESTIONS } from './test-fixtures';
import type { MappingResult, QuestionDefinition } from './types';

const TREE = buildQuestionTree(S1_6_QUESTIONS);

/** Values of one question, by column key. */
function valuesOf(result: MappingResult, questionId: string) {
  return Object.fromEntries(
    result.answers.filter((a) => a.questionId === questionId).map((a) => [a.columnKey, a.value]),
  );
}

function answerOf(result: MappingResult, questionId: string, columnKey = '') {
  const answer = result.answers.find(
    (a) => a.questionId === questionId && a.columnKey === columnKey,
  );
  if (!answer) throw new Error(`No answer for ${questionId} / "${columnKey}"`);
  return answer;
}

const sum = (values: Record<string, unknown>) =>
  Object.values(values).reduce<number>((total, v) => total + Number(v), 0);

const end = (endDate: string, reason = '059') => ({ ends: [{ endDate, reason, line: 0 }] });

describe('mapDsn on the provided dsn.txt', () => {
  const parsed = parseDsn(readFileSync(new URL('../../../dsn.txt', import.meta.url), 'utf8'));
  if (!parsed.ok) throw new Error('dsn.txt should parse');
  const result = mapDsn(parsed.dsn, TREE, parsed.warnings);

  it('derives November–December 2025 from the payment dates, as the declared month is 1946', () => {
    expect(result.period).toMatchObject({ start: '2025-11-01', end: '2025-12-31' });
  });

  it('answers every mapped question and fails none', () => {
    expect(result.failures).toEqual([]);
    expect(new Set(result.answers.map((a) => a.questionId))).toEqual(MAPPED_QUESTION_IDS);
    expect(result.employeeCount).toBe(100);
  });

  it('counts 100 employees, no leavers and 0 % turnover', () => {
    expect(valuesOf(result, 'S1-6_02')).toEqual({ '': 100 });
    expect(valuesOf(result, 'S1-6_03')).toEqual({ '': 100 });
    expect(valuesOf(result, 'S1-6_11')).toEqual({ '': 0 });
    expect(valuesOf(result, 'S1-6_12')).toEqual({ '': 0 });
    expect(answerOf(result, 'S1-6_11', '').provenance.notes).toEqual([
      'The DSN has no contract end block (S21.G00.62), so no employee left during the period.',
    ]);
  });

  it('places the establishment in Iran (S21.G00.11.015 = IR), so outside any French région', () => {
    expect(result.columns['S1-6_04']).toEqual([{ key: 'IR', label: 'Iran' }]);
    expect(valuesOf(result, 'S1-6_05')).toEqual({ IR: 100 });
    expect(valuesOf(result, 'S1-6_09')).toEqual({ 'outside-france': 100 });
  });

  it('splits contract × gender into 52 men and 48 women, unknown contract codes included', () => {
    const values = valuesOf(result, 'K_718');
    const bySex = (sex: string) =>
      sum(Object.fromEntries(Object.entries(values).filter(([key]) => key.endsWith(`:${sex}`))));
    expect(bySex('male')).toBe(52);
    expect(bySex('female')).toBe(48);
    expect(result.columns['S1-6_07']?.at(-1)?.label).toBe('Other / Unknown – Female');
    expect(answerOf(result, 'K_718', 'unknown:male').provenance.notes).toEqual([
      '94 employee(s) are under "Other / Unknown" because their contract type (S21.G00.40.007) is missing or not a known code.',
    ]);
  });

  it('accounts for every employee in the category table', () => {
    expect(sum(valuesOf(result, 'S1-6_19'))).toBe(100);
    expect(result.columns['S1-6_18']?.at(-1)?.key).toBe('unknown');
  });

  it('pre-fills the methodology questions', () => {
    expect(answerOf(result, 'S1-6_14').value).toBe('Head-count');
    expect(answerOf(result, 'S1-6_15').value).toBe('At end of period');
    expect(answerOf(result, 'S1-6_16').value).toEqual(
      expect.stringContaining('SIREN 397096943 for the period from 2025-11-01 to 2025-12-31'),
    );
    expect(result.answers.some((a) => a.questionId === 'S1-6_17')).toBe(false);
  });
});

describe('mapDsn head-counts', () => {
  const dsn = dsnOf([
    establishment([
      { id: 'stays', sex: '02' },
      { id: 'hired', contracts: [{ startDate: '2025-11-15' }] },
      { id: 'left', contracts: [end('2025-11-20')] },
      { id: 'cancelled-end', contracts: [end('2025-11-20', '099')] },
      { id: 'two-contracts', contracts: [{}, { contractType: '02' }] },
    ]),
  ]);
  const result = mapDsn(dsn, TREE);

  it('counts employees active at the end of the period, once each', () => {
    expect(valuesOf(result, 'S1-6_02')).toEqual({ '': 4 });
  });

  it('averages the head-counts at the start (4) and the end (4) of the period', () => {
    expect(valuesOf(result, 'S1-6_03')).toEqual({ '': 4 });
  });

  it('counts leavers, ignoring cancelled ends, and the turnover', () => {
    expect(valuesOf(result, 'S1-6_11')).toEqual({ '': 1 });
    expect(valuesOf(result, 'S1-6_12')).toEqual({ '': 25 });
  });

  it('describes the method and the rubriques used', () => {
    const { provenance } = answerOf(result, 'S1-6_02');
    expect(provenance.method).toContain('active on 2025-11-30');
    expect(provenance.rubriques).toContain('S21.G00.40.001');
    expect(provenance.notes).toEqual([]);
  });

  it('builds breakdown columns from the data, with the same columns for every row', () => {
    expect(result.columns['S1-6_07']?.map((c) => c.key)).toEqual([
      'permanent:male',
      'permanent:female',
    ]);
    expect(valuesOf(result, 'K_718')).toEqual({ 'permanent:male': 3, 'permanent:female': 1 });
    expect(valuesOf(result, 'K_719')).toEqual({ 'permanent:male': 3, 'permanent:female': 1 });
  });
});

describe('mapDsn breakdowns', () => {
  it('fills a 0 for a column that only exists at the start of the period', () => {
    const dsn = dsnOf([
      establishment([{ id: 'a' }]),
      establishment([{ id: 'b', contracts: [end('2025-11-10')] }], { postalCode: '29181' }),
    ]);
    const result = mapDsn(dsn, TREE);
    expect(result.columns['S1-6_08']?.map((c) => c.label)).toEqual(['Bretagne', 'Île-de-France']);
    expect(valuesOf(result, 'S1-6_09')).toEqual({ bretagne: 0, 'ile-de-france': 1 });
    expect(valuesOf(result, 'S1-6_10')).toEqual({ bretagne: 0.5, 'ile-de-france': 1 });
  });

  it('lists France first, then other countries by name', () => {
    const dsn = dsnOf([
      establishment([{ id: 'a' }], { countryCode: 'DE' }),
      establishment([{ id: 'b' }], { countryCode: 'BE' }),
      establishment([{ id: 'c' }]),
    ]);
    expect(mapDsn(dsn, TREE).columns['S1-6_04']?.map((c) => c.label)).toEqual([
      'France',
      'Belgium',
      'Germany',
    ]);
  });
});

describe('mapDsn failures', () => {
  it('fails the DSN questions, not the presets, when the DSN has no usable date', () => {
    const dsn = dsnOf([establishment([{ id: 'a', paymentDate: null }])], { declaredMonth: null });
    const result = mapDsn(dsn, TREE);

    expect(result.period).toBeNull();
    expect(result.failures.map((f) => f.questionId)).toContain('S1-6_02');
    expect(result.failures[0]?.message).toMatch(/no usable declared month.*Please fill it in/);
    expect(answerOf(result, 'S1-6_14').value).toBe('Head-count');
    expect(result.columns['S1-6_01']).toEqual([{ key: '', label: 'Total' }]);
  });

  it('fails a preset whose option was removed from questions.csv', () => {
    const questions: QuestionDefinition[] = S1_6_QUESTIONS.map((q) =>
      q.id === 'S1-6_14' ? { ...q, enumEn: ['People', 'FTE'] } : q,
    );
    const result = mapDsn(dsnOf([establishment([{ id: 'a' }])]), buildQuestionTree(questions));
    expect(result.failures).toEqual([
      {
        questionId: 'S1-6_14',
        message: expect.stringContaining('"Head-count" is no longer offered'),
      },
    ]);
  });

  it('only answers questions present in the tree', () => {
    const tree = buildQuestionTree([question('S1-6_17', 'TEXT')]);
    expect(mapDsn(dsnOf([establishment([{ id: 'a' }])]), tree).answers).toEqual([]);
  });

  it('answers a mapped question outside a table with a single "" column', () => {
    const tree = buildQuestionTree([question('S1-6_02', 'NUMBER')]);
    const result = mapDsn(dsnOf([establishment([{ id: 'a' }])]), tree);
    expect(result.answers.map((a) => [a.columnKey, a.value])).toEqual([['', 1]]);
  });
});

describe('turnover', () => {
  it('is null when the average is zero or a value is missing', () => {
    expect(turnoverRate(1, 0)).toBeNull();
    expect(turnoverRate(null, 10)).toBeNull();
    expect(turnoverRate('3', 10)).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(turnoverRate(1, 3)).toBe(33.3);
  });

  it('is recomputed from the leavers and the average head-count', () => {
    const derived = DERIVED_ANSWERS.find((d) => d.questionId === 'S1-6_12');
    expect(derived?.inputIds).toEqual(['S1-6_11', 'S1-6_03']);
    expect(derived?.compute([2, 8])).toBe(25);
  });

  it('carries the provenance of its inputs', () => {
    const result = mapDsn(dsnOf([establishment([{ id: 'a' }])]), TREE);
    expect(answerOf(result, 'S1-6_12').provenance).toMatchObject({
      method: 'Leavers ÷ average head-count × 100, rounded to one decimal.',
      rubriques: expect.arrayContaining(['S21.G00.40.001', 'S21.G00.62.002']),
    });
  });

  it('fails when an input is not in the questionnaire', () => {
    const tree = buildQuestionTree(S1_6_QUESTIONS.filter((q) => q.id !== 'S1-6_03'));
    const result = mapDsn(dsnOf([establishment([{ id: 'a' }])]), tree);
    expect(result.failures).toEqual([
      { questionId: 'S1-6_12', message: expect.stringContaining('depends on S1-6_11 and S1-6_03') },
    ]);
  });
});
