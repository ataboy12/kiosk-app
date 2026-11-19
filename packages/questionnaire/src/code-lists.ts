import type { Column } from './types';

/*
 * DSN code lists the mapping interprets. The parser keeps codes raw; this is the only place that
 * gives them a meaning. Values not listed here fall into the `UNKNOWN` group, which callers detect
 * by identity (`=== UNKNOWN`).
 * Source: DSN cahier technique 2024.1.
 */

export const UNKNOWN: Column = { key: 'unknown', label: 'Other / Unknown' };

/** S21.G00.30.005 */
const SEXES: Record<string, Column> = {
  '01': { key: 'male', label: 'Male' },
  '02': { key: 'female', label: 'Female' },
};
export const SEX_ORDER = ['male', 'female'];

export function sexOf(code: string | null): Column {
  return (code !== null && SEXES[code]) || UNKNOWN;
}

/**
 * S21.G00.40.007 (nature du contrat), grouped into the ESRS S1-6 contract types. Codes that aren't
 * employment contracts (internships, corporate mandates, civic service, …) go to `UNKNOWN`.
 */
const PERMANENT: Column = { key: 'permanent', label: 'Permanent' };
const TEMPORARY: Column = { key: 'temporary', label: 'Temporary' };
const NON_GUARANTEED: Column = { key: 'non-guaranteed', label: 'Non-guaranteed hours' };
const CONTRACT_GROUPS: Record<string, Column> = {
  '01': PERMANENT, // CDI de droit privé
  '08': PERMANENT, // CDI intérimaire
  '09': PERMANENT, // CDI de droit public
  '50': PERMANENT, // Nomination dans la fonction publique
  '82': PERMANENT, // CDI de chantier ou d'opération
  '91': PERMANENT, // Contrat d'engagement maritime à durée indéterminée
  '02': TEMPORARY, // CDD de droit privé
  '03': TEMPORARY, // Contrat de mission (intérim)
  '10': TEMPORARY, // CDD de droit public
  '92': TEMPORARY, // Contrat d'engagement maritime à durée déterminée
  '07': NON_GUARANTEED, // CDI intermittent: hours vary with activity
};
export const CONTRACT_GROUP_ORDER = [PERMANENT, TEMPORARY, NON_GUARANTEED].map((c) => c.key);

export function contractGroupOf(code: string | null): Column {
  return (code !== null && CONTRACT_GROUPS[code]) || UNKNOWN;
}

/** First digit of S21.G00.40.004 (PCS-ESE): the socio-professional group. */
const MANAGERS: Column = { key: 'pcs-3', label: 'Managers and higher intellectual professions' };
const PCS_GROUPS: Record<string, Column> = {
  '1': { key: 'pcs-1', label: 'Farmers' },
  '2': { key: 'pcs-2', label: 'Craftspeople, shopkeepers and business owners' },
  '3': MANAGERS,
  '4': { key: 'pcs-4', label: 'Intermediate professions' },
  '5': { key: 'pcs-5', label: 'Clerical and service workers' },
  '6': { key: 'pcs-6', label: 'Manual workers' },
};

/** S21.G00.40.003 (statut catégoriel retraite complémentaire), used when the PCS is unusable. */
const NON_MANAGERS: Column = { key: 'non-manager', label: 'Non-managers (unspecified)' };
const STATUS_GROUPS: Record<string, Column> = {
  '01': MANAGERS, // cadre
  '02': MANAGERS, // extension cadre
  '04': NON_MANAGERS, // non cadre
};
export const CATEGORY_ORDER = [...Object.values(PCS_GROUPS), NON_MANAGERS].map((c) => c.key);

export function categoryOf(pcs: string | null, status: string | null): Column {
  return (
    (pcs !== null && PCS_GROUPS[pcs.charAt(0)]) ||
    (status !== null && STATUS_GROUPS[status]) ||
    UNKNOWN
  );
}

/**
 * S21.G00.11.015. The DSN leaves it empty for addresses in the French postal system, so empty
 * means France. Names come from the runtime's ICU data.
 */
const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

export function countryOf(code: string | null): Column {
  const iso = code === null || code === '' ? 'FR' : code.toUpperCase();
  // ZZ is the ISO code for "unknown region". The regex rules out the input `of` would reject.
  const label = /^[A-Z]{2}$/.test(iso) && iso !== 'ZZ' ? countryNames.of(iso) : undefined;
  return label ? { key: iso, label } : UNKNOWN;
}

/** French régions and their départements (first two digits of the postal code; three overseas). */
const REGIONS: { key: string; label: string; departements: string[] }[] = [
  {
    key: 'auvergne-rhone-alpes',
    label: 'Auvergne-Rhône-Alpes',
    departements: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  },
  {
    key: 'bourgogne-franche-comte',
    label: 'Bourgogne-Franche-Comté',
    departements: ['21', '25', '39', '58', '70', '71', '89', '90'],
  },
  { key: 'bretagne', label: 'Bretagne', departements: ['22', '29', '35', '56'] },
  {
    key: 'centre-val-de-loire',
    label: 'Centre-Val de Loire',
    departements: ['18', '28', '36', '37', '41', '45'],
  },
  { key: 'corse', label: 'Corse', departements: ['20'] },
  {
    key: 'grand-est',
    label: 'Grand Est',
    departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  },
  {
    key: 'hauts-de-france',
    label: 'Hauts-de-France',
    departements: ['02', '59', '60', '62', '80'],
  },
  {
    key: 'ile-de-france',
    label: 'Île-de-France',
    departements: ['75', '77', '78', '91', '92', '93', '94', '95'],
  },
  { key: 'normandie', label: 'Normandie', departements: ['14', '27', '50', '61', '76'] },
  {
    key: 'nouvelle-aquitaine',
    label: 'Nouvelle-Aquitaine',
    departements: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  },
  {
    key: 'occitanie',
    label: 'Occitanie',
    departements: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  },
  {
    key: 'pays-de-la-loire',
    label: 'Pays de la Loire',
    departements: ['44', '49', '53', '72', '85'],
  },
  {
    key: 'provence-alpes-cote-d-azur',
    label: "Provence-Alpes-Côte d'Azur",
    departements: ['04', '05', '06', '13', '83', '84'],
  },
  { key: 'guadeloupe', label: 'Guadeloupe', departements: ['971'] },
  { key: 'martinique', label: 'Martinique', departements: ['972'] },
  { key: 'guyane', label: 'Guyane', departements: ['973'] },
  { key: 'la-reunion', label: 'La Réunion', departements: ['974'] },
  { key: 'mayotte', label: 'Mayotte', departements: ['976'] },
];

const REGION_BY_DEPARTEMENT = new Map(
  REGIONS.flatMap(({ key, label, departements }) =>
    departements.map((departement): [string, Column] => [departement, { key, label }]),
  ),
);
const OUTSIDE_FRANCE: Column = { key: 'outside-france', label: 'Outside France' };
export const REGION_ORDER = [...REGIONS.map((r) => r.key), OUTSIDE_FRANCE.key];

/** S21.G00.11.004 (postal code) → région. Postal codes are only meaningful in France. */
export function regionOf(postalCode: string | null, countryCode: string | null): Column {
  if (countryOf(countryCode).key !== 'FR') return OUTSIDE_FRANCE;
  if (postalCode === null || !/^\d{5}$/.test(postalCode)) return UNKNOWN;
  const departement = postalCode.startsWith('97') ? postalCode.slice(0, 3) : postalCode.slice(0, 2);
  return REGION_BY_DEPARTEMENT.get(departement) ?? UNKNOWN;
}
