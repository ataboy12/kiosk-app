import { describe, expect, it } from 'vitest';
import { buildQuestionTree, flattenQuestions, QuestionTreeError } from './question-tree';
import { question, S1_6_QUESTIONS } from './test-fixtures';
import type { QuestionNode } from './types';

const ids = (nodes: QuestionNode[]) => nodes.map((node) => node.id);

describe('buildQuestionTree', () => {
  it('builds the S1-6 tree: six top-level questions in order, table rows as children', () => {
    const tree = buildQuestionTree(S1_6_QUESTIONS);
    expect(ids(tree)).toEqual(['S1-6_01', 'S1-6_04', 'S1-6_07', 'S1-6_08', 'S1-6_18', 'S1-6_13']);
    expect(ids(tree[0]?.children ?? [])).toEqual(['S1-6_02', 'S1-6_03', 'S1-6_11', 'S1-6_12']);
    expect(ids(tree[5]?.children ?? [])).toEqual(['S1-6_14', 'S1-6_15', 'S1-6_16', 'S1-6_17']);
  });

  it('sorts siblings by order whatever the input order, and by id on ties', () => {
    const tree = buildQuestionTree([
      question('B', 'TEXT', null, 1),
      question('C', 'TEXT', null, 0),
      question('A', 'TEXT', null, 1),
    ]);
    expect(ids(tree)).toEqual(['C', 'A', 'B']);
  });

  it('nests to any depth, children listed before their parent', () => {
    const tree = buildQuestionTree([
      question('L3', 'NUMBER', 'L2'),
      question('L2', 'GROUP', 'L1'),
      question('L1', 'GROUP', 'L0'),
      question('L0', 'GROUP'),
    ]);
    expect(ids(flattenQuestions(tree))).toEqual(['L0', 'L1', 'L2', 'L3']);
  });

  it('allows a table inside a group', () => {
    const tree = buildQuestionTree([
      question('G', 'GROUP'),
      question('T', 'TABLE', 'G'),
      question('R', 'NUMBER', 'T'),
    ]);
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('R');
  });

  it('does not change its input', () => {
    const input = [question('B', 'TEXT', null, 1), question('A', 'TEXT', null, 0)];
    buildQuestionTree(input);
    expect(ids(input as QuestionNode[])).toEqual(['B', 'A']);
  });

  it.each([
    ['a duplicate id', [question('A', 'TEXT'), question('A', 'NUMBER')], /Duplicate question id A/],
    ['an unknown parent', [question('A', 'TEXT', 'Z')], /A references unknown parent Z/],
    [
      'a cycle',
      [question('R', 'GROUP'), question('A', 'GROUP', 'B'), question('B', 'GROUP', 'A')],
      /A, B form a cycle/,
    ],
    [
      'a table row with children',
      [question('T', 'TABLE'), question('R', 'NUMBER', 'T'), question('X', 'TEXT', 'R')],
      /R is a row of table T/,
    ],
    [
      'a table nested in a table',
      [question('T', 'TABLE'), question('U', 'TABLE', 'T')],
      /U is a row/,
    ],
  ])('rejects %s', (_, definitions, message) => {
    expect(() => buildQuestionTree(definitions)).toThrow(QuestionTreeError);
    expect(() => buildQuestionTree(definitions)).toThrow(message);
  });
});

describe('flattenQuestions', () => {
  it('lists every question depth first in display order', () => {
    const flat = flattenQuestions(buildQuestionTree(S1_6_QUESTIONS));
    expect(flat).toHaveLength(S1_6_QUESTIONS.length);
    expect(ids(flat).slice(0, 6)).toEqual([
      'S1-6_01',
      'S1-6_02',
      'S1-6_03',
      'S1-6_11',
      'S1-6_12',
      'S1-6_04',
    ]);
  });
});
