import type { Dsn, DsnWarning } from '@kiosk/dsn';
import { columnsOf, SCALAR_COLUMN, TABLE_BREAKDOWNS, type Breakdown } from './breakdowns';
import { DERIVED_ANSWERS, type DerivedAnswer } from './derived';
import { flattenQuestions } from './question-tree';
import { MappingError, RESOLVERS, type ResolverContext } from './resolvers';
import type {
  Column,
  ComputedAnswer,
  MappingFailure,
  MappingResult,
  QuestionNode,
  ReportingPeriod,
} from './types';
import {
  activePositions,
  leavingPositions,
  readReportingPeriod,
  readWorkforce,
  type Workforce,
} from './workforce';

const NOT_COMPUTED = 'This answer could not be computed from the DSN. Please fill it in.';

/** Question ids the DSN pre-fills: the form locks them until the answers arrive. */
export const MAPPED_QUESTION_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(RESOLVERS),
  ...DERIVED_ANSWERS.map((derived) => derived.questionId),
]);

/** The columns a question's answer has: its table's, or the single scalar column. */
interface Scope {
  breakdown: Breakdown;
  columns: Column[];
}

const SCALAR_SCOPE: Scope = { breakdown: [], columns: [SCALAR_COLUMN] };

const DERIVED_BY_ID = new Map(DERIVED_ANSWERS.map((derived) => [derived.questionId, derived]));

/**
 * Answers every question of the tree that has a resolver, then the derived answers. Never
 * throws: a question that fails becomes a `MappingFailure`, and the others are still answered.
 */
export function mapDsn(
  dsn: Dsn,
  tree: readonly QuestionNode[],
  dsnWarnings: readonly DsnWarning[] = [],
): MappingResult {
  const period = readReportingPeriod(dsn);
  const workforce = readWorkforce(dsn);
  const sirens = dsn.companies.flatMap((c) => (c.siren === null ? [] : [c.siren]));
  const questions = flattenQuestions(tree);

  const tables = new Map<string, Scope>();
  for (const table of questions.filter((q) => q.content === 'TABLE')) {
    const breakdown = TABLE_BREAKDOWNS[table.id] ?? [];
    tables.set(table.id, { breakdown, columns: tableColumns(breakdown, workforce, period) });
  }
  const scopeOf = (question: QuestionNode) =>
    (question.parentId !== null && tables.get(question.parentId)) || SCALAR_SCOPE;

  const answers: ComputedAnswer[] = [];
  const failures: MappingFailure[] = [];

  for (const question of questions) {
    const resolve = RESOLVERS[question.id];
    if (!resolve) continue;
    const scope = scopeOf(question);
    const context: ResolverContext = { question, ...scope, period, workforce, sirens, dsnWarnings };
    try {
      const { values, provenance } = resolve(context);
      for (const { key } of scope.columns) {
        answers.push({
          questionId: question.id,
          columnKey: key,
          value: values[key] ?? null,
          provenance,
        });
      }
    } catch (error) {
      const message =
        error instanceof MappingError ? `${error.message} ${NOT_COMPUTED}` : NOT_COMPUTED;
      failures.push({ questionId: question.id, message });
    }
  }

  for (const question of questions) {
    const derived = DERIVED_BY_ID.get(question.id);
    if (!derived) continue;
    const result = derive(derived, scopeOf(question).columns, answers);
    if ('message' in result) failures.push(result);
    else answers.push(...result);
  }

  return {
    period,
    columns: Object.fromEntries([...tables].map(([id, scope]) => [id, scope.columns])),
    answers,
    failures,
    employeeCount: workforce.employeeIds.size,
  };
}

/** Applies a derived answer to every column, or fails when an input wasn't computed. */
function derive(
  derived: DerivedAnswer,
  columns: Column[],
  answers: readonly ComputedAnswer[],
): ComputedAnswer[] | MappingFailure {
  const derivedAnswers: ComputedAnswer[] = [];
  for (const { key } of columns) {
    const inputs = derived.inputIds
      .map((id) => answers.find((a) => a.questionId === id && a.columnKey === key))
      .filter((input) => input !== undefined);
    if (inputs.length < derived.inputIds.length) {
      return {
        questionId: derived.questionId,
        message: `It depends on ${derived.inputIds.join(' and ')}, which could not all be computed. ${NOT_COMPUTED}`,
      };
    }
    derivedAnswers.push({
      questionId: derived.questionId,
      columnKey: key,
      value: derived.compute(inputs.map((input) => input.value)),
      provenance: {
        method: derived.method,
        rubriques: unique(inputs.flatMap((input) => input.provenance.rubriques)),
        notes: unique(inputs.flatMap((input) => input.provenance.notes)),
      },
    });
  }
  return derivedAnswers;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * The columns found among the employees the table counts: present at the start or the end of the
 * period, or leaving during it. A table with no data keeps the single scalar column.
 */
function tableColumns(
  breakdown: Breakdown,
  workforce: Workforce,
  period: ReportingPeriod | null,
): Column[] {
  const positions = period
    ? [
        ...activePositions(workforce.positions, period.start),
        ...activePositions(workforce.positions, period.end),
        ...leavingPositions(workforce.positions, period),
      ]
    : workforce.positions;
  const found = columnsOf(breakdown, positions);
  return found.length > 0 ? found : [SCALAR_COLUMN];
}
