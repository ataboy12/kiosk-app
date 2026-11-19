import { date, readFields, text } from './fields';
import type { BlockCode } from './hierarchy';
import { readBlocks, type RawBlock } from './read-blocks';
import type {
  Company,
  Contract,
  ContractEnd,
  Declaration,
  DsnErrorCode,
  DsnParseResult,
  DsnWarning,
  Employee,
  Establishment,
  Payment,
  PayPeriod,
} from './types';

/*
 * Stage 2: which rubriques each block contributes to the typed model. Reading a new rubrique
 * means adding one entry here and one property to the matching type.
 */
const DECLARATION_FIELDS = { declaredMonth: date('005') };
const COMPANY_FIELDS = { siren: text('001', { required: true }) };
const ESTABLISHMENT_FIELDS = {
  nic: text('001', { required: true }),
  postalCode: text('004'),
  countryCode: text('015'),
};
const EMPLOYEE_FIELDS = { id: text('001', { required: true }), sex: text('005') };
const CONTRACT_FIELDS = {
  startDate: date('001'),
  status: text('003'),
  occupationCategory: text('004'),
  contractType: text('007'),
};
const CONTRACT_END_FIELDS = { endDate: date('001'), reason: text('002') };
const PAYMENT_FIELDS = { paymentDate: date('001') };
const PAY_PERIOD_FIELDS = { start: date('001'), end: date('002') };

/**
 * Parses a DSN file. Never throws: bad values become warnings with line numbers, and the parse
 * only fails when the file has no company or no employees.
 *
 * Takes already decoded text; choosing the file's encoding is the caller's job.
 */
export function parseDsn(text: string): DsnParseResult {
  const warnings: DsnWarning[] = [];
  const roots = readBlocks(text, warnings);
  const reader = new ModelReader(warnings);

  const companies = childrenOf(roots, 'S21.G00.06').map((block) => reader.company(block));
  if (companies.length === 0) {
    return failure(
      'NOT_A_DSN',
      'This file does not look like a DSN: it has no company block (S21.G00.06).',
      warnings,
    );
  }

  const hasEmployees = companies.some((company) =>
    company.establishments.some((establishment) => establishment.employees.length > 0),
  );
  if (!hasEmployees) {
    return failure(
      'NO_EMPLOYEES',
      'This DSN declares no employees (no S21.G00.30 block).',
      warnings,
    );
  }

  const [declarationBlock] = childrenOf(roots, 'S20.G00.05');
  const declaration = declarationBlock ? reader.declaration(declarationBlock) : null;
  return { ok: true, dsn: { declaration, companies }, warnings: sortByLine(warnings) };
}

/** Turns raw blocks into the typed model, one method per block type, recording warnings. */
class ModelReader {
  constructor(private readonly warnings: DsnWarning[]) {}

  declaration(block: RawBlock): Declaration {
    return { ...readFields(block, DECLARATION_FIELDS, this.warnings), line: block.line };
  }

  company(block: RawBlock): Company {
    return {
      ...readFields(block, COMPANY_FIELDS, this.warnings),
      line: block.line,
      establishments: childrenOf(block.children, 'S21.G00.11').map((b) => this.establishment(b)),
    };
  }

  establishment(block: RawBlock): Establishment {
    return {
      ...readFields(block, ESTABLISHMENT_FIELDS, this.warnings),
      line: block.line,
      employees: childrenOf(block.children, 'S21.G00.30').map((b) => this.employee(b)),
    };
  }

  employee(block: RawBlock): Employee {
    const { id, sex } = readFields(block, EMPLOYEE_FIELDS, this.warnings);
    return {
      id: id ?? `line:${block.line}`,
      sex,
      line: block.line,
      contracts: childrenOf(block.children, 'S21.G00.40').map((b) => this.contract(b)),
      payments: childrenOf(block.children, 'S21.G00.50').map((b) => this.payment(b)),
    };
  }

  contract(block: RawBlock): Contract {
    return {
      ...readFields(block, CONTRACT_FIELDS, this.warnings),
      line: block.line,
      ends: childrenOf(block.children, 'S21.G00.62').map((b) => this.contractEnd(b)),
    };
  }

  contractEnd(block: RawBlock): ContractEnd {
    return { ...readFields(block, CONTRACT_END_FIELDS, this.warnings), line: block.line };
  }

  payment(block: RawBlock): Payment {
    return {
      ...readFields(block, PAYMENT_FIELDS, this.warnings),
      line: block.line,
      payPeriods: childrenOf(block.children, 'S21.G00.51').map((b) => this.payPeriod(b)),
    };
  }

  payPeriod(block: RawBlock): PayPeriod {
    return { ...readFields(block, PAY_PERIOD_FIELDS, this.warnings), line: block.line };
  }
}

function childrenOf(blocks: RawBlock[], code: BlockCode): RawBlock[] {
  return blocks.filter((block) => block.code === code);
}

function sortByLine(warnings: DsnWarning[]): DsnWarning[] {
  return warnings.toSorted((a, b) => a.line - b.line);
}

function failure(code: DsnErrorCode, message: string, warnings: DsnWarning[]): DsnParseResult {
  return { ok: false, error: { code, message }, warnings: sortByLine(warnings) };
}
