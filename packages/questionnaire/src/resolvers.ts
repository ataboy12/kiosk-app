import type { DsnWarning } from '@kiosk/dsn';
import {
  countByColumn,
  DIMENSIONS,
  groupingOf,
  rubriquesOf,
  unknownCounts,
  type Breakdown,
} from './breakdowns';
import { UNKNOWN } from './code-lists';
import type { AnswerValue, Column, Provenance, QuestionNode, ReportingPeriod } from './types';
import { activePositions, leavingPositions, type Position, type Workforce } from './workforce';

/** A question the mapping can't answer, with a message for the user. */
export class MappingError extends Error {
  override name = 'MappingError';
}

export interface ResolverContext {
  question: QuestionNode;
  /** The parent table's breakdown; empty outside tables. */
  breakdown: Breakdown;
  columns: Column[];
  period: ReportingPeriod | null;
  workforce: Workforce;
  sirens: string[];
  dsnWarnings: readonly DsnWarning[];
}

export interface Resolution {
  /** One value per column key. Missing keys become `null`. */
  values: Record<string, AnswerValue>;
  provenance: Provenance;
}

/** Computes one question's answer from the DSN. Throws a `MappingError` when it can't. */
export type Resolver = (context: ResolverContext) => Resolution;

const CONTRACT_DATES = ['S21.G00.30.001', 'S21.G00.40.001', 'S21.G00.62.001', 'S21.G00.62.002'];

function requirePeriod(context: ResolverContext): ReportingPeriod {
  if (context.period === null) {
    throw new MappingError('The DSN has no usable declared month or payment date.');
  }
  return context.period;
}

function perColumn(columns: Column[], value: (key: string) => AnswerValue) {
  return Object.fromEntries(columns.map((column) => [column.key, value(column.key)]));
}

/** Notes shared by every head-count: employees not counted, codes not recognised. */
function headcountNotes(context: ResolverContext, counted: readonly Position[]): string[] {
  const { employeesWithoutContract } = context.workforce;
  const notes =
    employeesWithoutContract > 0
      ? [
          `${employeesWithoutContract} employee(s) have no contract block (S21.G00.40) and are not counted.`,
        ]
      : [];
  for (const { dimension, count } of unknownCounts(context.breakdown, counted)) {
    notes.push(
      `${count} employee(s) are under "${UNKNOWN.label}" because their ${dimension.name} (${dimension.rubriques.join(' / ')}) is missing or not a known code.`,
    );
  }
  return notes;
}

function headcounts(context: ResolverContext, date: string) {
  const positions = activePositions(context.workforce.positions, date);
  return { positions, counts: countByColumn(context.breakdown, positions) };
}

const endOfPeriodHeadcount: Resolver = (context) => {
  const { end } = requirePeriod(context);
  const { positions, counts } = headcounts(context, end);
  return {
    values: perColumn(context.columns, (key) => counts.get(key) ?? 0),
    provenance: {
      method: `Employees with a contract active on ${end} (started by then, not ended before), counted once by identifier${groupingOf(context.breakdown)}.`,
      rubriques: [...CONTRACT_DATES, ...rubriquesOf(context.breakdown)],
      notes: headcountNotes(context, positions),
    },
  };
};

const averageHeadcount: Resolver = (context) => {
  const { start, end } = requirePeriod(context);
  const atStart = headcounts(context, start);
  const atEnd = headcounts(context, end);
  return {
    values: perColumn(
      context.columns,
      (key) => ((atStart.counts.get(key) ?? 0) + (atEnd.counts.get(key) ?? 0)) / 2,
    ),
    provenance: {
      method: `Mean of the head-count on ${start} and on ${end}${groupingOf(context.breakdown)}. A single DSN covers one declaration, so this approximates the average over the period.`,
      rubriques: [...CONTRACT_DATES, ...rubriquesOf(context.breakdown)],
      notes: headcountNotes(context, atEnd.positions),
    },
  };
};

const leavers: Resolver = (context) => {
  const period = requirePeriod(context);
  const counts = countByColumn(
    context.breakdown,
    leavingPositions(context.workforce.positions, period),
  );
  const hasEnds = context.workforce.positions.some((p) => p.contract.ends.length > 0);
  return {
    values: perColumn(context.columns, (key) => counts.get(key) ?? 0),
    provenance: {
      method: `Employees with a contract end dated from ${period.start} to ${period.end}, excluding cancellations (reason 099), counted once by identifier${groupingOf(context.breakdown)}.`,
      rubriques: ['S21.G00.30.001', 'S21.G00.62.001', 'S21.G00.62.002'],
      notes: hasEnds
        ? []
        : [
            'The DSN has no contract end block (S21.G00.62), so no employee left during the period.',
          ],
    },
  };
};

/** A preset enum option. Fails if questions.csv no longer offers it. */
function presetOption(option: string, reason: string): Resolver {
  return (context) => {
    if (!context.question.enumEn.includes(option)) {
      throw new MappingError(`The option "${option}" is no longer offered for this question.`);
    }
    return {
      values: perColumn(context.columns, () => option),
      provenance: { method: reason, rubriques: [], notes: [] },
    };
  };
}

const contextText: Resolver = (context) => {
  const period = requirePeriod(context);
  const { positions, employeeIds } = context.workforce;
  const atEnd = activePositions(positions, period.end);
  const company = context.sirens.length > 0 ? `SIREN ${context.sirens.join(', ')}` : 'the company';
  const quality = unknownCounts(DIMENSIONS, atEnd).map(
    ({ dimension, count }) => `${count} with an unrecognised ${dimension.name}`,
  );

  const sentences = [
    `Figures are computed from the DSN of ${company} for the period from ${period.start} to ${period.end}. ${period.source}`,
    `The DSN lists ${employeeIds.size} employee(s); ${atEnd.length} have an active contract at the end of the period.`,
    'Head-counts are numbers of people. Averages are the mean of the head-count at the start and the end of the period, because a single DSN covers only one declaration.',
    quality.length > 0
      ? `Data quality: of the employees at the end of the period, ${quality.join(', ')}; they are reported under "${UNKNOWN.label}".`
      : null,
    context.dsnWarnings.length > 0
      ? `The file raised ${context.dsnWarnings.length} reading warning(s).`
      : null,
  ].filter((sentence) => sentence !== null);

  return {
    values: perColumn(context.columns, () => sentences.join(' ')),
    provenance: {
      method: 'Generated from the reporting period, the head-count and the data-quality checks.',
      rubriques: ['S21.G00.06.001', 'S20.G00.05.005', 'S21.G00.50.001'],
      notes: [],
    },
  };
};

/**
 * One resolver per question the DSN answers directly. Changing a mapping touches one entry here.
 * A row resolver is called once per table and returns a value for every column. Answers computed
 * from other answers (turnover) are in `DERIVED_ANSWERS`.
 */
export const RESOLVERS: Readonly<Record<string, Resolver>> = {
  'S1-6_02': endOfPeriodHeadcount,
  'S1-6_03': averageHeadcount,
  'S1-6_11': leavers,
  'S1-6_05': endOfPeriodHeadcount,
  'S1-6_06': averageHeadcount,
  K_718: endOfPeriodHeadcount,
  K_719: averageHeadcount,
  'S1-6_09': endOfPeriodHeadcount,
  'S1-6_10': averageHeadcount,
  'S1-6_19': endOfPeriodHeadcount,
  'S1-6_20': averageHeadcount,
  'S1-6_14': presetOption('Head-count', 'Every figure counts people, not full-time equivalents.'),
  'S1-6_15': presetOption(
    'At end of period',
    'The main figures are head-counts at the end of the period; averages are given alongside.',
  ),
  'S1-6_16': contextText,
};
