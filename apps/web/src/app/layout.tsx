import '@mantine/core/styles.css';
import './tokens.css';

import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Serif } from 'next/font/google';
import type { ReactNode } from 'react';
import { theme } from '~/theme';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
});

const serif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-plex-serif',
});

export const metadata: Metadata = {
  title: 'Kiosk · DSN workforce reporting',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps} className={`${sans.variable} ${serif.variable}`}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
