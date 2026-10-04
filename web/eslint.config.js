import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TEST_FILES = ['**/*.test.{ts,tsx}', 'tests/**'];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, comments.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.node },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // A disable comment must say why (`-- reason`); the limits below are
      // never silenced this way, they are fixed by splitting the code.
      '@eslint-community/eslint-comments/require-description': 'error',
      // ARQ-16 readability limits.
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-lines': ['error', 250],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    plugins: { react },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/no-danger': 'error',
    },
  },
  {
    // Tests stay whole rather than sliced to fit the file-size limit.
    files: TEST_FILES,
    rules: { 'max-lines': 'off' },
  },
);
