import { z } from 'zod';

/**
 * Parses questions.csv into seed rows.
 *
 * The file is irregular: `;` separator, many empty trailing columns, mixed casing in `content`
 * (`Table` / `number` / `Text`), and enum options separated by ", " (not ";" as the brief says).
 */

export type QuestionContent = 'GROUP' | 'NUMBER' | 'TEXT' | 'ENUM' | 'TABLE';

export interface QuestionSeed {
  id: string;
  labelEn: string;
  labelFr: string;
  content: QuestionContent;
  parentId: string | null;
  order: number;
  unit: string | null;
  enumEn: string[];
  enumFr: string[];
}

const CONTENT_BY_RAW: Record<string, QuestionContent> = {
  '': 'GROUP',
  number: 'NUMBER',
  text: 'TEXT',
  enum: 'ENUM',
  table: 'TABLE',
};

const emptyToNull = (value: string) => (value === '' ? null : value);
const splitOptions = (value: string) =>
  value === ''
    ? []
    : value
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean);

const rowSchema = z
  .object({
    ID: z.string().min(1, 'missing ID'),
    'question label en': z.string().min(1, 'missing English label'),
    'question label fr': z.string(),
    content: z
      .string()
      .transform((raw) => raw.toLowerCase())
      .refine((raw) => raw in CONTENT_BY_RAW, { message: 'unknown content type' })
      .transform((raw) => CONTENT_BY_RAW[raw] as QuestionContent),
    'relatedQuestion ID': z.string().transform(emptyToNull),
    order: z.coerce.number().int().nonnegative(),
    unit: z.string().transform(emptyToNull),
    'enum en': z.string().transform(splitOptions),
    'enum fr': z.string().transform(splitOptions),
  })
  .transform((row): QuestionSeed => ({
    id: row.ID,
    labelEn: row['question label en'],
    labelFr: row['question label fr'],
    content: row.content,
    parentId: row['relatedQuestion ID'],
    order: row.order,
    unit: row.unit,
    enumEn: row['enum en'],
    enumFr: row['enum fr'],
  }));

export function parseQuestionsCsv(csv: string): QuestionSeed[] {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) throw new Error('questions.csv is empty');

  const header = headerLine.split(';').map((cell) => cell.trim());

  const questions = dataLines.map((line, index) => {
    const cells = line.split(';');
    const record = Object.fromEntries(
      header.filter(Boolean).map((name) => [name, (cells[header.indexOf(name)] ?? '').trim()]),
    );
    const result = rowSchema.safeParse(record);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new Error(`questions.csv line ${index + 2}: ${issues.join('; ')}`);
    }
    return result.data;
  });

  assertValidTree(questions);
  return questions;
}

function assertValidTree(questions: QuestionSeed[]) {
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) throw new Error(`questions.csv: duplicate ID ${q.id}`);
    ids.add(q.id);
  }
  for (const q of questions) {
    if (q.parentId && !ids.has(q.parentId)) {
      throw new Error(`questions.csv: ${q.id} references unknown parent ${q.parentId}`);
    }
    if (q.content === 'ENUM' && q.enumEn.length === 0) {
      throw new Error(`questions.csv: enum question ${q.id} has no options`);
    }
  }
}
