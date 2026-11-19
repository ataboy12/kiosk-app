import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDsn } from './parse-dsn';
import type { Dsn, DsnParseResult, Employee } from './types';

/** Joins lines into a DSN text. */
const dsn = (...lines: string[]) => lines.join('\n');

/** The blocks every valid DSN starts with: declaration, company, establishment. */
const HEAD = [
  "S20.G00.05,''",
  "S20.G00.05.005,'20251101'",
  "S21.G00.06,''",
  "S21.G00.06.001,'123456789'",
  "S21.G00.11,''",
  "S21.G00.11.001,'00012'",
];

function expectOk(result: DsnParseResult): Extract<DsnParseResult, { ok: true }> {
  if (!result.ok) throw new Error(`Expected a successful parse, got ${result.error.code}`);
  return result;
}

function employeesOf(parsed: Dsn): Employee[] {
  return parsed.companies.flatMap((c) => c.establishments.flatMap((e) => e.employees));
}

describe('parseDsn on the provided dsn.txt', () => {
  const text = readFileSync(new URL('../../../dsn.txt', import.meta.url), 'utf8');
  const result = expectOk(parseDsn(text));
  const employees = employeesOf(result.dsn);

  it('reads 1 company, 1 establishment and 100 employees', () => {
    expect(result.dsn.companies).toHaveLength(1);
    expect(result.dsn.companies[0]?.establishments).toHaveLength(1);
    expect(employees).toHaveLength(100);
    expect(new Set(employees.map((e) => e.id)).size).toBe(100);
  });

  it('gives each employee one contract, one payment and one pay period, and no contract end', () => {
    for (const employee of employees) {
      expect(employee.contracts).toHaveLength(1);
      expect(employee.contracts[0]?.ends).toEqual([]);
      expect(employee.payments).toHaveLength(1);
      expect(employee.payments[0]?.payPeriods).toHaveLength(1);
    }
  });

  it('reads 52 men and 48 women', () => {
    expect(employees.filter((e) => e.sex === '01')).toHaveLength(52);
    expect(employees.filter((e) => e.sex === '02')).toHaveLength(48);
  });

  it('reads the payment dates in Nov–Dec 2025', () => {
    const dates = employees.flatMap((e) => e.payments.map((p) => p.paymentDate)).toSorted();
    expect(dates[0]).toBe('2025-11-09');
    expect(dates.at(-1)).toBe('2025-12-09');
  });

  it("reads the declared month as is (checking it against the payment dates is the mapping's job)", () => {
    expect(result.dsn.declaration).toEqual({ declaredMonth: '1946-07-20', line: 27 });
  });

  it('keeps contract codes as raw values', () => {
    expect(employees[0]?.contracts[0]).toEqual({
      startDate: '1921-06-29',
      status: 'AZ',
      occupationCategory: '9226',
      contractType: '11',
      line: 99,
      ends: [],
    });
  });

  it('reports no warnings', () => {
    expect(result.warnings).toEqual([]);
  });
});

describe('parseDsn block structure', () => {
  it('starts a new block when the rubrique number stops increasing, even without a header', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          "S21.G00.30.005,'01'",
          "S21.G00.30.001,'222'",
          "S21.G00.30.005,'02'",
        ),
      ),
    );
    expect(employeesOf(result.dsn).map((e) => [e.id, e.sex])).toEqual([
      ['111', '01'],
      ['222', '02'],
    ]);
  });

  it('keeps consecutive employee blocks separate', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30,''",
          "S21.G00.30.001,'111'",
          "S21.G00.30,''",
          "S21.G00.30.001,'222'",
        ),
      ),
    );
    expect(employeesOf(result.dsn).map((e) => e.id)).toEqual(['111', '222']);
  });

  it('keeps every establishment', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          "S21.G00.11,''",
          "S21.G00.11.001,'00034'",
          "S21.G00.11.015,'DE'",
          "S21.G00.30.001,'222'",
        ),
      ),
    );
    const establishments = result.dsn.companies[0]?.establishments ?? [];
    expect(establishments.map((e) => [e.nic, e.countryCode, e.employees.map((x) => x.id)])).toEqual(
      [
        ['00012', null, ['111']],
        ['00034', 'DE', ['222']],
      ],
    );
  });

  it('attaches contracts, contract ends and pay periods to the right parents', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          "S21.G00.40.001,'20200101'",
          "S21.G00.40.007,'01'",
          "S21.G00.62.001,'20251115'",
          "S21.G00.62.002,'059'",
          "S21.G00.40.001,'20250101'",
          "S21.G00.40.007,'02'",
          "S21.G00.50.001,'20251130'",
          "S21.G00.51.001,'20251101'",
          "S21.G00.51.002,'20251130'",
          "S21.G00.51.001,'20251101'",
          "S21.G00.51.002,'20251115'",
          "S21.G00.30.001,'222'",
          "S21.G00.50.001,'20251130'",
        ),
      ),
    );
    const [first, second] = employeesOf(result.dsn);
    expect(first?.contracts).toMatchObject([
      { contractType: '01', ends: [{ endDate: '2025-11-15', reason: '059' }] },
      { contractType: '02', ends: [] },
    ]);
    expect(first?.payments[0]?.payPeriods).toMatchObject([
      { start: '2025-11-01', end: '2025-11-30' },
      { start: '2025-11-01', end: '2025-11-15' },
    ]);
    expect(second).toMatchObject({ id: '222', contracts: [], payments: [{ payPeriods: [] }] });
  });

  it("doesn't attach a contract end to the previous employee's contract", () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          "S21.G00.40.007,'01'",
          "S21.G00.30.001,'222'",
          "S21.G00.62.001,'20251115'",
        ),
      ),
    );
    expect(employeesOf(result.dsn)[0]?.contracts[0]?.ends).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'ORPHAN_BLOCK', line: 10 })]);
  });

  it('ignores a contract that comes before any employee', () => {
    const result = expectOk(parseDsn(dsn(...HEAD, "S21.G00.40.007,'01'", "S21.G00.30.001,'111'")));
    expect(employeesOf(result.dsn)[0]?.contracts).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'ORPHAN_BLOCK', line: 7 })]);
  });

  it('groups unsupported blocks into one warning per block type', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          "S21.G00.40.007,'01'",
          "S21.G00.41.001,'20251101'",
          "S21.G00.41,''",
          "S21.G00.41.001,'20251102'",
          "S21.G00.62.001,'20251115'",
        ),
      ),
    );
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'UNSUPPORTED_BLOCK',
        line: 9,
        message: expect.stringMatching(/^2 S21\.G00\.41 blocks/),
      }),
    ]);
    // A contract end after the unsupported block still belongs to the contract.
    expect(employeesOf(result.dsn)[0]?.contracts[0]?.ends).toHaveLength(1);
  });

  it('accepts CRLF line endings, a BOM and blank lines', () => {
    const text = `\uFEFF${dsn(...HEAD, '', "S21.G00.30.001,'111'").replaceAll('\n', '\r\n')}\r\n`;
    const result = expectOk(parseDsn(text));
    expect(employeesOf(result.dsn).map((e) => e.id)).toEqual(['111']);
    expect(result.warnings).toEqual([]);
  });
});

describe('parseDsn values', () => {
  it('parses a file without a declaration block', () => {
    const result = expectOk(parseDsn(dsn(...HEAD.slice(2), "S21.G00.30.001,'111'")));
    expect(result.dsn.declaration).toBeNull();
    expect(employeesOf(result.dsn).map((e) => e.id)).toEqual(['111']);
    expect(result.warnings).toEqual([]);
  });

  it('skips the S10 header blocks without a warning', () => {
    const result = expectOk(
      parseDsn(dsn("S10.G00.00,''", "S10.G00.00.001,'x'", ...HEAD, "S21.G00.30.001,'111'")),
    );
    expect(result.warnings).toEqual([]);
  });

  it('reports bad lines and values with their line numbers', () => {
    const result = expectOk(
      parseDsn(
        dsn(
          ...HEAD,
          "S21.G00.30.001,'111'",
          'this is not a DSN line',
          "S21.G00.40.001,'20250231'",
          "S21.G00.40.007,'11'",
        ),
      ),
    );
    expect(result.warnings.map((w) => [w.code, w.line, w.rubrique])).toEqual([
      ['MALFORMED_LINE', 8, undefined],
      ['INVALID_VALUE', 9, 'S21.G00.40.001'],
    ]);
    expect(employeesOf(result.dsn)[0]?.contracts[0]).toMatchObject({
      startDate: null,
      contractType: '11',
    });
  });

  it('keeps quotes inside values', () => {
    const result = expectOk(parseDsn(dsn(...HEAD, "S21.G00.30.001,'O'Brien'")));
    expect(employeesOf(result.dsn)[0]?.id).toBe("O'Brien");
  });

  it('reads a valid declared month', () => {
    const result = expectOk(parseDsn(dsn(...HEAD, "S21.G00.30.001,'111'")));
    expect(result.dsn.declaration?.declaredMonth).toBe('2025-11-01');
  });

  it('identifies an employee without 30.001 by its line, with a warning', () => {
    const result = expectOk(parseDsn(dsn(...HEAD, "S21.G00.30,''", "S21.G00.30.005,'01'")));
    expect(employeesOf(result.dsn).map((e) => [e.id, e.sex])).toEqual([['line:7', '01']]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'MISSING_VALUE', line: 7, rubrique: 'S21.G00.30.001' }),
    ]);
  });

  it('warns when a required identifier is missing', () => {
    const result = expectOk(
      parseDsn(dsn("S20.G00.05,''", "S21.G00.06,''", "S21.G00.11,''", "S21.G00.30.001,'111'")),
    );
    expect(result.warnings.map((w) => [w.code, w.rubrique])).toEqual([
      ['MISSING_VALUE', 'S21.G00.06.001'],
      ['MISSING_VALUE', 'S21.G00.11.001'],
    ]);
  });
});

describe('parseDsn failures', () => {
  it.each([
    ['an empty file', ''],
    ['random text', 'hello\nworld'],
    ['a file without a company block', dsn("S20.G00.05,''", "S21.G00.30.001,'111'")],
  ])('rejects %s as not a DSN', (_, text) => {
    expect(parseDsn(text)).toMatchObject({ ok: false, error: { code: 'NOT_A_DSN' } });
  });

  it('rejects a DSN without employees', () => {
    expect(parseDsn(dsn(...HEAD))).toMatchObject({ ok: false, error: { code: 'NO_EMPLOYEES' } });
  });
});
