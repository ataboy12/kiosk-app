import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseQuestionsCsv } from './parse-questions-csv';

const HEADER =
  'ID;question label en;question label fr;content;relatedQuestion ID;order;unit;enum en;enum fr;;;';

describe('parseQuestionsCsv', () => {
  it('parses the provided questions.csv', () => {
    const csv = readFileSync(new URL('../../../../questions.csv', import.meta.url), 'utf8');
    const questions = parseQuestionsCsv(csv);

    expect(questions).toHaveLength(22);
    expect(questions.filter((q) => q.content === 'TABLE').map((q) => q.id)).toEqual([
      'S1-6_01',
      'S1-6_04',
      'S1-6_07',
      'S1-6_08',
      'S1-6_18',
    ]);
    expect(questions.find((q) => q.id === 'S1-6_12')).toMatchObject({
      parentId: 'S1-6_01',
      order: 3,
      unit: '%',
    });
    expect(questions.find((q) => q.id === 'S1-6_13')?.content).toBe('GROUP');
    expect(questions.find((q) => q.id === 'S1-6_15')).toMatchObject({
      content: 'ENUM',
      enumEn: ['At end of period', 'During period', 'Other'],
      enumFr: ['A la fin de la période', 'Moyenne sur la période', 'Autre'],
    });
  });

  it('normalises content casing and empty cells', () => {
    const [question] = parseQuestionsCsv(`${HEADER}\nQ1;Label;Libellé;TEXT;;0;;;;;;`);
    expect(question).toMatchObject({ content: 'TEXT', parentId: null, unit: null, enumEn: [] });
  });

  it('rejects unknown content types with the line number', () => {
    expect(() => parseQuestionsCsv(`${HEADER}\nQ1;Label;Libellé;date;;0;;;;;;`)).toThrow(
      /line 2: content: unknown content type/,
    );
  });

  it('rejects references to unknown parents', () => {
    expect(() => parseQuestionsCsv(`${HEADER}\nQ1;Label;Libellé;number;Q0;0;;;;;;`)).toThrow(
      /Q1 references unknown parent Q0/,
    );
  });
});
