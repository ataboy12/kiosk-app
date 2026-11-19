/**
 * The typed result of parsing a DSN. Everything is plain JSON (dates are ISO strings), so the
 * result can be stored in a `jsonb` column or passed from a server to a client component.
 *
 * Every entity keeps the line of its block so answers computed from it can cite their source.
 * Codes are kept as raw strings: v1 doesn't check them, and the mapping groups unexpected values
 * under "Other / Unknown". Unreadable dates become `null`.
 */

/** A calendar date as `YYYY-MM-DD`. */
export type IsoDate = string;

export interface Dsn {
  /** `null` when the file has no S20.G00.05 block. */
  declaration: Declaration | null;
  companies: Company[];
}

export interface Declaration {
  /** S20.G00.05.005. `null` when missing or not a date. */
  declaredMonth: IsoDate | null;
  line: number;
}

export interface Company {
  /** S21.G00.06.001 */
  siren: string | null;
  line: number;
  establishments: Establishment[];
}

export interface Establishment {
  /** S21.G00.11.001 */
  nic: string | null;
  /** S21.G00.11.004 */
  postalCode: string | null;
  /** S21.G00.11.015. Empty means France. */
  countryCode: string | null;
  line: number;
  employees: Employee[];
}

export interface Employee {
  /** S21.G00.30.001, or `line:<n>` when absent. */
  id: string;
  /** S21.G00.30.005 */
  sex: string | null;
  line: number;
  contracts: Contract[];
  payments: Payment[];
}

export interface Contract {
  /** S21.G00.40.001 */
  startDate: IsoDate | null;
  /** S21.G00.40.003 */
  status: string | null;
  /** S21.G00.40.004 */
  occupationCategory: string | null;
  /** S21.G00.40.007 */
  contractType: string | null;
  line: number;
  /** S21.G00.62 blocks. A list, so a later block never hides an earlier one. */
  ends: ContractEnd[];
}

export interface ContractEnd {
  /** S21.G00.62.001 */
  endDate: IsoDate | null;
  /** S21.G00.62.002 */
  reason: string | null;
  line: number;
}

export interface Payment {
  /** S21.G00.50.001 */
  paymentDate: IsoDate | null;
  line: number;
  payPeriods: PayPeriod[];
}

export interface PayPeriod {
  /** S21.G00.51.001 */
  start: IsoDate | null;
  /** S21.G00.51.002 */
  end: IsoDate | null;
  line: number;
}

export type DsnWarningCode =
  /** The line isn't `<rubrique>,'<value>'`. */
  | 'MALFORMED_LINE'
  /** A block type the parser doesn't read yet. One warning per block type. */
  | 'UNSUPPORTED_BLOCK'
  /** A block whose parent block is missing, e.g. a contract before any employee. */
  | 'ORPHAN_BLOCK'
  /** A value with the wrong format, e.g. an impossible date. */
  | 'INVALID_VALUE'
  /** A value the parser needs is absent. */
  | 'MISSING_VALUE';

export interface DsnWarning {
  code: DsnWarningCode;
  message: string;
  /** 1-based line in the file. */
  line: number;
  /** Full rubrique code, e.g. `S21.G00.40.007`. */
  rubrique?: string;
  value?: string;
}

export type DsnErrorCode = 'NOT_A_DSN' | 'NO_EMPLOYEES';

export type DsnParseResult =
  | { ok: true; dsn: Dsn; warnings: DsnWarning[] }
  | { ok: false; error: { code: DsnErrorCode; message: string }; warnings: DsnWarning[] };
