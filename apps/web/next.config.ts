import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages export TypeScript source, so Next compiles them.
  transpilePackages: ['@kiosk/db', '@kiosk/docx-export', '@kiosk/dsn', '@kiosk/questionnaire'],
  experimental: {
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
};

export default config;
