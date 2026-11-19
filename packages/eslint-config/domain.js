import base from './base.js';

/**
 * Domain packages (dsn, questionnaire, docx-export) stay pure:
 * they must never depend on persistence or on the web app.
 */
export default [
  ...base,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@kiosk/db',
                '@kiosk/db/*',
                '@kiosk/web',
                '@kiosk/web/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'pg',
              ],
              message: 'Domain packages must not depend on the database or the web app.',
            },
          ],
        },
      ],
    },
  },
];
