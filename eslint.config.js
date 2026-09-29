// Inlined from Tether's tether-dev-docs eslint.config.js (Apache-2.0).
import tseslintPlugin from '@typescript-eslint/eslint-plugin'
import tseslintParser from '@typescript-eslint/parser'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginImport from 'eslint-plugin-import'
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import globals from 'globals'

export default [
  { ignores: ['src/PearPass/**'] },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        Pear: 'readonly'
      }
    },
    plugins: {
      prettier: eslintPluginPrettier,
      import: eslintPluginImport,
      react: eslintPluginReact
    },
    rules: {
      ...eslintConfigPrettier.rules,
      'prettier/prettier': [
        'error',
        {
          semi: false,
          singleQuote: true,
          useTabs: false,
          tabWidth: 2,
          trailingComma: 'none',
          bracketSpacing: true,
          arrowParens: 'always',
          endOfLine: 'auto',
          embeddedLanguageFormatting: 'auto'
        }
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-tabs': 'error',
      'no-underscore-dangle': ['error', { allowAfterThis: true }],
      'no-unsafe-optional-chaining': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^React$',
          ignoreRestSiblings: true
        }
      ],
      'no-undef': 'error',
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type'
          ],
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before'
            }
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          },
          'newlines-between': 'always'
        }
      ],
      'react/jsx-uses-vars': 'error',
      'arrow-body-style': ['error', 'as-needed']
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: { '@typescript-eslint': tseslintPlugin },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^React$',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  },
  {
    files: ['**/*.test.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: globals.jest
    }
  }
]
