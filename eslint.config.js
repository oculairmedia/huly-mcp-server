import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-node';
import jestPlugin from 'eslint-plugin-jest';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      '.git/**',
      'coverage/**',
      'dist/**',
      'build/**',
      '*.min.js',
      'worktrees/**',
      '.env',
      '.env.*',
      'package-lock.json',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      node: nodePlugin,
      jest: jestPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // Error prevention
      'no-console': 'off', // Allow console for logging
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-undef': 'error',
      'no-constant-condition': 'warn',
      'no-debugger': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-var': 'error',

      // ES6
      'no-duplicate-imports': 'error',
      'prefer-template': 'error',

      // Node.js specific
      'node/no-unsupported-features/es-syntax': 'off', // We're using ES modules
      'node/no-missing-import': 'off', // Doesn't work well with ES modules
      'node/no-unpublished-import': 'off',

      // Disable formatting rules that conflict with Prettier
      ...prettierConfig.rules,
    },
  },
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js'],
    plugins: {
      jest: jestPlugin,
    },
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        it: 'readonly',
      },
    },
    rules: {
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/valid-expect': 'error',
    },
  },
];
