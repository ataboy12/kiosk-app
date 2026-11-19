import type { Contract, ContractEnd, Dsn, Establishment, IsoDate } from '@kiosk/dsn';
import type { ReportingPeriod } from './types';

/** S21.G00.62.002 value that cancels an earlier contract end. */
const CANCELLED_END = '099';

/**
 * One contract of one employee, with what the breakdowns need. An employee appears once per
 * contract, so several contracts or establishments per employee need no special case here.
 */
export interface Position {
  employeeId: string;
  sex: string | null;
  establishment: Establishment;
  contract: Contract;
}

export interface Workforce {
  positions: Position[];
  employeeIds: Set<string>;
  /** Employees with no contract block: they can't be counted at any date. */
  employeesWithoutContract: number;
}

export function readWorkforce(dsn: Dsn): Workforce {
  const positions: Position[] = [];
  const employeeIds = new Set<string>();
  let employeesWithoutContract = 0;

  for (const company of dsn.companies) {
    for (const establishment of company.establishments) {
      for (const employee of establishment.employees) {
        employeeIds.add(employee.id);
        if (employee.contracts.length === 0) employeesWithoutContract++;
        for (const contract of employee.contracts) {
          positions.push({ employeeId: employee.id, sex: employee.sex, establishment, contract });
        }
      }
    }
  }
  return { positions, employeeIds, employeesWithoutContract };
}

/** Contract ends that aren't cancellations. */
function effectiveEnds(contract: Contract): ContractEnd[] {
  return contract.ends.filter((end) => end.reason !== CANCELLED_END);
}

/** Started on or before `date` (an unknown start counts as started) and not ended before it. */
export function isActiveAt(contract: Contract, date: IsoDate): boolean {
  const started = contract.startDate === null || contract.startDate <= date;
  const ended = effectiveEnds(contract).some((end) => end.endDate !== null && end.endDate < date);
  return started && !ended;
}

/** Keeps the first position of each employee, so employees are counted once. */
function firstPerEmployee(positions: readonly Position[]): Position[] {
  const byEmployee = new Map<string, Position>();
  for (const position of positions) {
    if (!byEmployee.has(position.employeeId)) byEmployee.set(position.employeeId, position);
  }
  return [...byEmployee.values()];
}

/** Positions active at `date`, one per employee (the first active contract wins). */
export function activePositions(positions: readonly Position[], date: IsoDate): Position[] {
  return firstPerEmployee(positions.filter((p) => isActiveAt(p.contract, date)));
}

/** Positions whose contract ended during the period, one per employee (cancellations excluded). */
export function leavingPositions(
  positions: readonly Position[],
  period: ReportingPeriod,
): Position[] {
  return firstPerEmployee(
    positions.filter((p) =>
      effectiveEnds(p.contract).some(
        (end) => end.endDate !== null && end.endDate >= period.start && end.endDate <= period.end,
      ),
    ),
  );
}

/**
 * The reporting period: the declared month (S20.G00.05.005) when payment dates (S21.G00.50.001)
 * fall in it, otherwise the whole months spanned by the payment dates. A monthly DSN declares the
 * payments made in its month, so payment dates are more reliable than pay periods, which can run
 * past it. `null` when the DSN has no usable date.
 */
export function readReportingPeriod(dsn: Dsn): ReportingPeriod | null {
  const paymentDates = dsn.companies
    .flatMap((c) => c.establishments.flatMap((e) => e.employees))
    .flatMap((employee) => employee.payments.map((payment) => payment.paymentDate))
    .filter((date): date is IsoDate => date !== null)
    .toSorted();

  const declaredMonth = dsn.declaration?.declaredMonth ?? null;
  if (declaredMonth !== null) {
    const month = { start: monthStart(declaredMonth), end: monthEnd(declaredMonth) };
    const matchesPay =
      paymentDates.length === 0 || paymentDates.some((d) => d >= month.start && d <= month.end);
    if (matchesPay) {
      return { ...month, source: 'Declared month of the DSN (S20.G00.05.005).' };
    }
  }

  const first = paymentDates[0];
  const last = paymentDates.at(-1);
  if (first === undefined || last === undefined) return null;

  const reason =
    declaredMonth === null
      ? 'the DSN has no declared month'
      : `the declared month (${declaredMonth}) does not match them`;
  return {
    start: monthStart(first),
    end: monthEnd(last),
    source: `Whole months covered by the payment dates (S21.G00.50.001), because ${reason}.`,
  };
}

function monthStart(date: IsoDate): IsoDate {
  return `${date.slice(0, 7)}-01`;
}

function monthEnd(date: IsoDate): IsoDate {
  const [year, month] = date.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}
