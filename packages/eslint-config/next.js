import nextVitals from 'eslint-config-next/core-web-vitals';
import base from './base.js';

/** Rules for the Next.js app: Next's Core Web Vitals preset (React, hooks, a11y, Next) on top of base. */
export default [
  ...base,
  ...nextVitals,
  { ignores: ['.next/**', 'next-env.d.ts'] },
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
];
