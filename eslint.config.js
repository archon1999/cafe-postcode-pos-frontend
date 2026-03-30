import storybook from 'eslint-plugin-storybook';

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import * as prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import { globalIgnores } from 'eslint/config';
import i18next from 'eslint-plugin-i18next';
import pluginQuery from '@tanstack/eslint-plugin-query';

const storybookFlatConfig =
  storybook.configs?.['flat/recommended'] ??
  storybook.configs?.recommended?.overrides?.map((override) => ({
    files: override.files,
    plugins: {
      storybook,
    },
    rules: override.rules ?? {},
  })) ??
  [];

export default tseslint.config(
  [
    globalIgnores(['dist', './.storybook', './vitest.shims.d.ts']),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [
        js.configs.recommended,
        tseslint.configs.recommended,
        react.configs.flat.recommended,
        react.configs.flat['jsx-runtime'],
        reactHooks.configs['recommended-latest'],
        reactRefresh.configs.vite,
        eslintPluginPrettierRecommended,
        i18next.configs['flat/recommended'],
        prettierConfig,
      ],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
        parserOptions: {
          project: ['./tsconfig.json', './tsconfig.node.json'],
        },
      },
      plugins: {
        import: importPlugin,
        prettierConfig,
        '@tanstack/query': pluginQuery,
      },
      rules: {

        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/jsx-uses-react': 'off',
        'react/jsx-uses-vars': 'error',

        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',

        'import/no-unresolved': 'error',
        'import/no-duplicates': 'error',
        'import/order': [
          'error',
          {
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            alphabetize: { order: 'asc', caseInsensitive: true },
            'newlines-between': 'always',
          },
        ],

        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-unused-vars': 'off',
        'no-debugger': 'error',
        eqeqeq: ['error', 'always'],
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-floating-promises': 'warn',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        'react-refresh/only-export-components': 'off',
        'i18next/no-literal-string': 'warn',
      },
      settings: {
        react: { version: 'detect' },
        'import/resolver': {
          typescript: {
            project: './tsconfig.json',
          },
          node: {
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
          },
        },
      },
    },
    ...(Array.isArray(storybookFlatConfig)
      ? storybookFlatConfig
      : [storybookFlatConfig]),
  ],
);
