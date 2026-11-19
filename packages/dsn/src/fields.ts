import type { RawBlock } from './read-blocks';
import type { DsnWarning, IsoDate } from './types';

/** How to read one rubrique of a block. */
interface FieldSpec<T> {
  rubrique: string;
  /** Report a `MISSING_VALUE` warning when the rubrique is absent. */
  required: boolean;
  /** Converts the raw value, or returns `null` when it can't be read. */
  read: (raw: string) => T | null;
  /** What a readable value looks like, for the `INVALID_VALUE` warning. */
  expected: string;
}

type FieldSpecs = Record<string, FieldSpec<unknown>>;

type FieldValues<S extends FieldSpecs> = {
  [K in keyof S]: S[K] extends FieldSpec<infer T> ? T | null : never;
};

/** Free text or a code, kept as is. */
export function text(rubrique: string, { required = false } = {}): FieldSpec<string> {
  return { rubrique, required, read: (raw) => raw, expected: 'text' };
}

/** `YYYYMMDD` → `YYYY-MM-DD`. Impossible dates (`20250231`) can't be read. */
export function date(rubrique: string): FieldSpec<IsoDate> {
  return { rubrique, required: false, read: readDate, expected: 'a valid date (YYYYMMDD)' };
}

function readDate(raw: string): IsoDate | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (match === null) return null;

  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exists = parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  return exists ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Reads a block's fields according to `specs`, recording a warning for each problem. */
export function readFields<S extends FieldSpecs>(
  block: RawBlock,
  specs: S,
  warnings: DsnWarning[],
): FieldValues<S> {
  const values: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(specs)) {
    const rubrique = `${block.code}.${spec.rubrique}`;
    const field = block.fields.get(spec.rubrique);

    if (field === undefined || field.value === '') {
      values[key] = null;
      if (spec.required) {
        warnings.push({
          code: 'MISSING_VALUE',
          message: `${rubrique} is missing in the block starting on line ${block.line}.`,
          line: block.line,
          rubrique,
        });
      }
      continue;
    }

    const value = spec.read(field.value);
    values[key] = value;
    if (value === null) {
      warnings.push({
        code: 'INVALID_VALUE',
        message: `${rubrique} on line ${field.line}: "${field.value}" is not ${spec.expected}.`,
        line: field.line,
        rubrique,
        value: field.value,
      });
    }
  }

  return values as FieldValues<S>;
}
