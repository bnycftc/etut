/**
 * Runs only in the "react-compiler" Jest project (package.json `jest.projects`, transformer
 * `scripts/jest-react-compiler.js`), next to app-smoke and app-real-storage. Proves that project
 * really applies the React Compiler to the app's code as the device bundle does; otherwise those
 * two files would run there a second time against the same hand-written code and prove nothing.
 */

import { InfoLink } from '../ui/info-link';

it('compiles the app code with the React Compiler', () => {
  // A compiled component keeps its JSX in a memo cache; the sentinel marks a slot not yet filled.
  expect(String(InfoLink)).toContain('react.memo_cache_sentinel');
});
