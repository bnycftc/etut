/**
 * ESLint runs eslint-plugin-react-hooks only: the rules of hooks and the React Compiler's checks
 * (app.json turns the compiler on for the bundles), each one a warning. CI prints the findings and
 * never fails on them (.github/workflows/ci.yml, "Lint"); no other lint rules on purpose.
 * `npm run lint`. The parser only strips TypeScript, nothing is type-checked here (that is tsc).
 */

const tsParser = require('@typescript-eslint/parser');
const reactHooks = require('eslint-plugin-react-hooks');

const recommended = Object.assign({}, ...reactHooks.configs['recommended-latest'].map((config) => config.rules ?? {}));

module.exports = [
  {
    // The 'widget' layouts are no React components (the extension runs them as plain functions)
    // and tests are in no bundle.
    ignores: ['src/system/ios/**', '**/__tests__/**', 'src/sync/testing/**'],
  },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser },
    plugins: { 'react-hooks': reactHooks },
    rules: Object.fromEntries(Object.keys(recommended).map((rule) => [rule, 'warn'])),
  },
];
