// eslint.config.mjs
import tsParser from '@typescript-eslint/parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    files: ['**/*.ts'],
    ignores: ['dist/**', 'node_modules/**', '.tmp/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        // Make it absolute, avoiding the "." problem
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.json']
      }
    },
    rules: {}
  }
];
