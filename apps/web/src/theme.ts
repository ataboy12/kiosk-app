import { createTheme, type MantineColorsTuple } from '@mantine/core';

/*
 * "Working paper": the form reads like an auditor's sheet, with each answer's source written in
 * the margin. Ink for text and actions; moss for what the DSN computed; amber for what the user
 * changed or added. The same values are exposed as CSS variables in `tokens.css`.
 */

const ink: MantineColorsTuple = [
  '#eef2f7',
  '#d9e0ea',
  '#b3c1d4',
  '#8aa0bd',
  '#6782a8',
  '#4f6b94',
  '#3b5680',
  '#2b4468',
  '#1c2b3a',
  '#111b26',
];

const moss: MantineColorsTuple = [
  '#eaf6f0',
  '#cfeadd',
  '#a1d4bb',
  '#6fbd97',
  '#49a67a',
  '#358f66',
  '#2e7d5b',
  '#24644a',
  '#1a4b37',
  '#103224',
];

const amber: MantineColorsTuple = [
  '#fff6e6',
  '#ffe9c2',
  '#fdd38a',
  '#f5b84f',
  '#e39b1f',
  '#c98105',
  '#b26a00',
  '#8f5500',
  '#6d4100',
  '#4a2c00',
];

export const theme = createTheme({
  colors: { ink, moss, amber },
  primaryColor: 'ink',
  primaryShade: 8,
  black: '#1c2b3a',
  defaultRadius: 'sm',
  fontFamily: 'var(--font-plex-sans), system-ui, sans-serif',
  headings: {
    fontFamily: 'var(--font-plex-serif), Georgia, serif',
    fontWeight: '500',
  },
});
