import {
  CATEGORY_ORDER,
  categoryOf,
  CONTRACT_GROUP_ORDER,
  contractGroupOf,
  countryOf,
  REGION_ORDER,
  regionOf,
  SEX_ORDER,
  sexOf,
  UNKNOWN,
} from './code-lists';
import type { Column } from './types';
import type { Position } from './workforce';

/** One way to classify an employee: by gender, by contract type, by country, … */
export interface Dimension {
  /** Plain-language name, e.g. "contract type". */
  name: string;
  rubriques: string[];
  /** The employee's value, or `UNKNOWN` when the code is missing or not recognised. */
  valueOf: (position: Position) => Column;
  /** Display order of the known values. Unlisted values follow by label, then `UNKNOWN`. */
  order: string[];
}

const gender: Dimension = {
  name: 'gender',
  rubriques: ['S21.G00.30.005'],
  valueOf: (p) => sexOf(p.sex),
  order: SEX_ORDER,
};

const contractType: Dimension = {
  name: 'contract type',
  rubriques: ['S21.G00.40.007'],
  valueOf: (p) => contractGroupOf(p.contract.contractType),
  order: CONTRACT_GROUP_ORDER,
};

const country: Dimension = {
  name: 'country of the establishment',
  rubriques: ['S21.G00.11.015'],
  valueOf: (p) => countryOf(p.establishment.countryCode),
  order: ['FR'],
};

const region: Dimension = {
  name: 'région of the establishment',
  rubriques: ['S21.G00.11.004', 'S21.G00.11.015'],
  valueOf: (p) => regionOf(p.establishment.postalCode, p.establishment.countryCode),
  order: REGION_ORDER,
};

const category: Dimension = {
  name: 'socio-professional category',
  rubriques: ['S21.G00.40.004', 'S21.G00.40.003'],
  valueOf: (p) => categoryOf(p.contract.occupationCategory, p.contract.status),
  order: CATEGORY_ORDER,
};

/** Every dimension, for data-quality checks. */
export const DIMENSIONS: readonly Dimension[] = [gender, contractType, country, region, category];

/** How a table splits employees into columns: one column per combination of dimension values. */
export type Breakdown = readonly Dimension[];

/** The single column of a question outside tables, or of a table without a breakdown. */
export const SCALAR_COLUMN: Column = { key: '', label: 'Total' };

/** A table's columns, as found in the DSN. A table the mapping didn't see has a single column. */
export function tableColumns(
  columns: Readonly<Record<string, Column[]>>,
  tableId: string,
): Column[] {
  return columns[tableId] ?? [SCALAR_COLUMN];
}

/** The breakdown of each table, by table question id. The table's rows are its child questions. */
export const TABLE_BREAKDOWNS: Readonly<Record<string, Breakdown>> = {
  'S1-6_01': [],
  'S1-6_04': [country],
  'S1-6_07': [contractType, gender],
  'S1-6_08': [region],
  'S1-6_18': [category],
};

export function columnOf(breakdown: Breakdown, position: Position): Column {
  if (breakdown.length === 0) return SCALAR_COLUMN;
  const values = breakdown.map((dimension) => dimension.valueOf(position));
  return {
    key: values.map((v) => v.key).join(':'),
    label: values.map((v) => v.label).join(' – '),
  };
}

/** Completes a provenance sentence, e.g. ", grouped by contract type and gender". */
export function groupingOf(breakdown: Breakdown): string {
  return breakdown.length === 0 ? '' : `, grouped by ${breakdown.map((d) => d.name).join(' and ')}`;
}

export function rubriquesOf(breakdown: Breakdown): string[] {
  return breakdown.flatMap((dimension) => dimension.rubriques);
}

/** Distinct columns of `positions`, sorted dimension by dimension. */
export function columnsOf(breakdown: Breakdown, positions: readonly Position[]): Column[] {
  const columns = new Map<string, { column: Column; ranks: number[] }>();
  for (const position of positions) {
    const column = columnOf(breakdown, position);
    if (columns.has(column.key)) continue;
    const ranks = breakdown.map((dimension) => rankOf(dimension, dimension.valueOf(position)));
    columns.set(column.key, { column, ranks });
  }
  return [...columns.values()]
    .sort((a, b) => compareRanks(a.ranks, b.ranks) || a.column.label.localeCompare(b.column.label))
    .map(({ column }) => column);
}

function rankOf(dimension: Dimension, value: Column): number {
  if (value === UNKNOWN) return dimension.order.length + 1;
  const index = dimension.order.indexOf(value.key);
  return index === -1 ? dimension.order.length : index;
}

function compareRanks(a: number[], b: number[]): number {
  for (const [i, rank] of a.entries()) {
    const diff = rank - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Number of positions per column key. */
export function countByColumn(
  breakdown: Breakdown,
  positions: readonly Position[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const position of positions) {
    const { key } = columnOf(breakdown, position);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** For each dimension with unrecognised values among `positions`: how many. */
export function unknownCounts(
  dimensions: readonly Dimension[],
  positions: readonly Position[],
): { dimension: Dimension; count: number }[] {
  return dimensions
    .map((dimension) => ({
      dimension,
      count: positions.filter((p) => dimension.valueOf(p) === UNKNOWN).length,
    }))
    .filter(({ count }) => count > 0);
}
