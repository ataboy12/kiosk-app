import type { Company, Contract, Dsn, Employee, Establishment, IsoDate } from '@kiosk/dsn';
import type { QuestionContent, QuestionDefinition } from './types';

/* Test helpers only: builds questions and DSN models with sensible defaults. */

export function question(
  id: string,
  content: QuestionContent,
  parentId: string | null = null,
  order = 0,
  extra: Partial<QuestionDefinition> = {},
): QuestionDefinition {
  return {
    id,
    labelEn: id,
    labelFr: id,
    content,
    parentId,
    order,
    unit: null,
    enumEn: [],
    enumFr: [],
    ...extra,
  };
}

/** The S1-6 questions of questions.csv (labels shortened). */
export const S1_6_QUESTIONS: QuestionDefinition[] = [
  question('S1-6_01', 'TABLE', null, 0),
  question('S1-6_02', 'NUMBER', 'S1-6_01', 0),
  question('S1-6_03', 'NUMBER', 'S1-6_01', 1),
  question('S1-6_11', 'NUMBER', 'S1-6_01', 2),
  question('S1-6_12', 'NUMBER', 'S1-6_01', 3, { unit: '%' }),
  question('S1-6_04', 'TABLE', null, 1),
  question('S1-6_05', 'NUMBER', 'S1-6_04', 0),
  question('S1-6_06', 'NUMBER', 'S1-6_04', 1),
  question('S1-6_07', 'TABLE', null, 2),
  question('K_718', 'NUMBER', 'S1-6_07', 0),
  question('K_719', 'NUMBER', 'S1-6_07', 1),
  question('S1-6_08', 'TABLE', null, 3),
  question('S1-6_09', 'NUMBER', 'S1-6_08', 0),
  question('S1-6_10', 'NUMBER', 'S1-6_08', 1),
  question('S1-6_18', 'TABLE', null, 4),
  question('S1-6_19', 'NUMBER', 'S1-6_18', 0),
  question('S1-6_20', 'NUMBER', 'S1-6_18', 1),
  question('S1-6_13', 'GROUP', null, 5),
  question('S1-6_14', 'ENUM', 'S1-6_13', 0, { enumEn: ['Head-count', 'Full-time equivalent'] }),
  question('S1-6_15', 'ENUM', 'S1-6_13', 1, {
    enumEn: ['At end of period', 'During period', 'Other'],
  }),
  question('S1-6_16', 'TEXT', 'S1-6_13', 2),
  question('S1-6_17', 'TEXT', 'S1-6_13', 3),
];

export interface EmployeeSpec {
  id: string;
  sex?: string | null;
  contracts?: Partial<Contract>[];
  paymentDate?: IsoDate | null;
}

export function contract(fields: Partial<Contract> = {}): Contract {
  return {
    startDate: '2020-01-01',
    status: null,
    occupationCategory: null,
    contractType: '01',
    line: 0,
    ends: [],
    ...fields,
  };
}

export function employee(spec: EmployeeSpec): Employee {
  return {
    id: spec.id,
    sex: spec.sex === undefined ? '01' : spec.sex,
    line: 0,
    contracts: (spec.contracts ?? [{}]).map(contract),
    payments: [
      {
        paymentDate: spec.paymentDate === undefined ? '2025-11-25' : spec.paymentDate,
        line: 0,
        payPeriods: [],
      },
    ],
  };
}

export function establishment(
  employees: EmployeeSpec[],
  fields: Partial<Omit<Establishment, 'employees'>> = {},
): Establishment {
  return {
    nic: '00012',
    postalCode: '75011',
    countryCode: null,
    line: 0,
    ...fields,
    employees: employees.map(employee),
  };
}

/** A DSN declared for November 2025 (unless `declaredMonth` says otherwise). */
export function dsnOf(
  establishments: Establishment[],
  { declaredMonth = '2025-11-01' as IsoDate | null } = {},
): Dsn {
  const company: Company = { siren: '123456789', line: 0, establishments };
  return { declaration: { declaredMonth, line: 0 }, companies: [company] };
}
