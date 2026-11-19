import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Shared rules for every TypeScript package. */
export default tseslint.config(
  { ignores: ['build/**', 'dist/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Needs the TypeScript parser; Next's preset parses plain .js files with Babel.
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
);
