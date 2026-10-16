/**
 * Jest transformer of the "react-compiler" project (package.json → jest.projects): the app's own
 * code goes through babel-preset-expo with the React Compiler on, as Metro builds the device and
 * web bundles (app.json `experiments.reactCompiler` → caller `supportsReactCompiler`). Everything
 * else keeps jest-expo's transform unchanged: node_modules, which Metro never compiles
 * (caller `isNodeModule`), and the tests themselves, which are not in any bundle.
 */

const { createTransformer: createBabelTransformer } = require('babel-jest');
const jestExpo = require('jest-expo/jest-preset');

const APP_CODE = /^(?!.*[\\/](node_modules|__tests__)[\\/])/;

module.exports = {
  createTransformer() {
    const [, options] = jestExpo.transform['\\.[jt]sx?$'];
    const plain = createBabelTransformer(options);
    const compiled = createBabelTransformer({ ...options, caller: { ...options.caller, supportsReactCompiler: true } });
    const pick = (filename) => (APP_CODE.test(filename) ? compiled : plain);
    return {
      canInstrument: true,
      getCacheKey: (source, filename, transformOptions) => pick(filename).getCacheKey(source, filename, transformOptions),
      process: (source, filename, transformOptions) => pick(filename).process(source, filename, transformOptions),
    };
  },
};
