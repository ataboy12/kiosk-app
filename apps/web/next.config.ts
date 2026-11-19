import type { NextConfig } from 'next';

const config: NextConfig = {
  // Workspace packages export TypeScript source, so Next compiles them.
  transpilePackages: ['@kiosk/db', '@kiosk/docx-export', '@kiosk/dsn', '@kiosk/questionnaire'],
  experimental: {
    // Above MAX_DSN_BYTES (4 MB, apps/web/src/server/dsn-file.ts), plus room for the multipart overhead.
    serverActions: { bodySizeLimit: '5mb' },
    optimizePackageImports: ['@mantine/core', '@mantine/hooks'],
  },
};

export default config;
