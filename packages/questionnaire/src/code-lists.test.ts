import { describe, expect, it } from 'vitest';
import { categoryOf, contractGroupOf, countryOf, regionOf, sexOf, UNKNOWN } from './code-lists';

describe('sexOf', () => {
  it('reads 01 / 02 and sends anything else to Other / Unknown', () => {
    expect(sexOf('01').key).toBe('male');
    expect(sexOf('02').key).toBe('female');
    expect(sexOf('03')).toBe(UNKNOWN);
    expect(sexOf(null)).toBe(UNKNOWN);
  });
});

describe('contractGroupOf', () => {
  it.each([
    ['01', 'permanent'],
    ['82', 'permanent'],
    ['02', 'temporary'],
    ['03', 'temporary'],
    ['07', 'non-guaranteed'],
    ['29', 'unknown'], // internship: not an employment contract
    ['80', 'unknown'], // corporate mandate
    ['11', 'unknown'], // not a code
    [null, 'unknown'],
  ])('%s → %s', (code, group) => {
    expect(contractGroupOf(code).key).toBe(group);
  });
});

describe('categoryOf', () => {
  it('uses the first digit of the PCS-ESE code', () => {
    expect(categoryOf('382a', null).key).toBe('pcs-3');
    expect(categoryOf('6', '04').key).toBe('pcs-6');
  });

  it('falls back to the pension status when the PCS is unusable', () => {
    expect(categoryOf('9226', '01').key).toBe('pcs-3');
    expect(categoryOf(null, '04').key).toBe('non-manager');
  });

  it('sends unreadable values to Other / Unknown', () => {
    expect(categoryOf('9226', 'AZ')).toBe(UNKNOWN);
    expect(categoryOf(null, null)).toBe(UNKNOWN);
  });
});

describe('countryOf', () => {
  it('treats an empty country as France', () => {
    expect(countryOf(null)).toEqual({ key: 'FR', label: 'France' });
    expect(countryOf('')).toEqual({ key: 'FR', label: 'France' });
  });

  it('names ISO codes, whatever their case', () => {
    expect(countryOf('ir')).toEqual({ key: 'IR', label: 'Iran' });
  });

  it.each(['ZZ', 'XX', '99', 'FRA'])('sends %s to Other / Unknown', (code) => {
    expect(countryOf(code)).toBe(UNKNOWN);
  });
});

describe('regionOf', () => {
  it('maps every metropolitan département to exactly one région', () => {
    for (let n = 1; n <= 95; n++) {
      const postalCode = `${String(n).padStart(2, '0')}100`;
      expect(regionOf(postalCode, null), postalCode).not.toBe(UNKNOWN);
    }
  });

  it.each([
    ['75011', 'Île-de-France'],
    ['29181', 'Bretagne'],
    ['20000', 'Corse'],
    ['97400', 'La Réunion'],
    ['97600', 'Mayotte'],
  ])('%s → %s', (postalCode, region) => {
    expect(regionOf(postalCode, null).label).toBe(region);
  });

  it('puts establishments abroad outside France', () => {
    expect(regionOf('29181', 'IR').key).toBe('outside-france');
    expect(regionOf('29181', 'FR').label).toBe('Bretagne');
  });

  it.each([null, '7501', 'ABCDE', '98000', '97500'])(
    'sends %s to Other / Unknown',
    (postalCode) => {
      expect(regionOf(postalCode, null)).toBe(UNKNOWN);
    },
  );
});
