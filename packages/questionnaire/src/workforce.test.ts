import { describe, expect, it } from 'vitest';
import { contract, dsnOf, establishment } from './test-fixtures';
import {
  activePositions,
  isActiveAt,
  leavingPositions,
  readReportingPeriod,
  readWorkforce,
} from './workforce';

const NOVEMBER = { start: '2025-11-01', end: '2025-11-30', source: '' };

describe('readReportingPeriod', () => {
  it('uses the declared month when payment dates fall in it', () => {
    const dsn = dsnOf([establishment([{ id: 'a', paymentDate: '2025-11-25' }])]);
    expect(readReportingPeriod(dsn)).toMatchObject({ start: '2025-11-01', end: '2025-11-30' });
  });

  it('uses the declared month when there are no payment dates', () => {
    const dsn = dsnOf([establishment([{ id: 'a', paymentDate: null }])], {
      declaredMonth: '2024-02-01',
    });
    expect(readReportingPeriod(dsn)).toMatchObject({ start: '2024-02-01', end: '2024-02-29' });
  });

  it('otherwise covers the whole months of the payment dates', () => {
    const dsn = dsnOf(
      [
        establishment([
          { id: 'a', paymentDate: '2025-12-09' },
          { id: 'b', paymentDate: '2025-11-09' },
        ]),
      ],
      { declaredMonth: '1946-07-01' },
    );
    const period = readReportingPeriod(dsn);
    expect(period).toMatchObject({ start: '2025-11-01', end: '2025-12-31' });
    expect(period?.source).toContain('declared month (1946-07-01) does not match');
  });

  it('works without a declared month', () => {
    const dsn = dsnOf([establishment([{ id: 'a' }])], { declaredMonth: null });
    const period = readReportingPeriod(dsn);
    expect(period).toMatchObject({ start: '2025-11-01', end: '2025-11-30' });
    expect(period?.source).toContain('no declared month');
  });

  it('returns null when the DSN has no usable date', () => {
    const dsn = dsnOf([establishment([{ id: 'a', paymentDate: null }])], { declaredMonth: null });
    expect(readReportingPeriod(dsn)).toBeNull();
  });
});

describe('isActiveAt', () => {
  const ended = (endDate: string, reason = '059') =>
    contract({ ends: [{ endDate, reason, line: 0 }] });

  it('needs the contract to have started', () => {
    expect(isActiveAt(contract({ startDate: '2025-11-15' }), '2025-11-14')).toBe(false);
    expect(isActiveAt(contract({ startDate: '2025-11-15' }), '2025-11-15')).toBe(true);
    expect(isActiveAt(contract({ startDate: null }), '2025-11-15')).toBe(true);
  });

  it('counts the employee up to the end date included', () => {
    expect(isActiveAt(ended('2025-11-20'), '2025-11-20')).toBe(true);
    expect(isActiveAt(ended('2025-11-20'), '2025-11-21')).toBe(false);
  });

  it('ignores cancelled ends (099)', () => {
    expect(isActiveAt(ended('2025-11-20', '099'), '2025-11-30')).toBe(true);
  });
});

describe('positions', () => {
  it('counts an employee with two active contracts once', () => {
    const dsn = dsnOf([establishment([{ id: 'a', contracts: [{}, {}] }, { id: 'b' }])]);
    const { positions } = readWorkforce(dsn);
    expect(positions).toHaveLength(3);
    expect(activePositions(positions, '2025-11-30').map((p) => p.employeeId)).toEqual(['a', 'b']);
  });

  it('counts an employee present in two establishments once', () => {
    const dsn = dsnOf([establishment([{ id: 'a' }]), establishment([{ id: 'a' }])]);
    const workforce = readWorkforce(dsn);
    expect(workforce.employeeIds.size).toBe(1);
    expect(activePositions(workforce.positions, '2025-11-30')).toHaveLength(1);
  });

  it('counts employees without a contract separately', () => {
    const dsn = dsnOf([establishment([{ id: 'a', contracts: [] }, { id: 'b' }])]);
    expect(readWorkforce(dsn)).toMatchObject({ employeesWithoutContract: 1 });
  });

  it('finds leavers whose effective end falls in the period', () => {
    const end = (endDate: string, reason = '059') => ({ ends: [{ endDate, reason, line: 0 }] });
    const dsn = dsnOf([
      establishment([
        { id: 'in-period', contracts: [end('2025-11-30')] },
        { id: 'before', contracts: [end('2025-10-31')] },
        { id: 'after', contracts: [end('2025-12-01')] },
        { id: 'cancelled', contracts: [end('2025-11-15', '099')] },
        { id: 'two-ends', contracts: [end('2025-11-10'), end('2025-11-20')] },
        { id: 'stays' },
      ]),
    ]);
    const leavers = leavingPositions(readWorkforce(dsn).positions, NOVEMBER);
    expect(leavers.map((p) => p.employeeId)).toEqual(['in-period', 'two-ends']);
  });
});
