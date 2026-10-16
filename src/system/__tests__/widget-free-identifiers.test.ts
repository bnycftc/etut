/// <reference types="node" />
/**
 * The `'widget'` layouts in `src/system/ios/` as the device gets them. babel-preset-expo's widgets
 * plugin turns each `'widget'` function into a source string that the extension evaluates in its
 * own JavaScriptCore context (expo-widgets `bundle/index.ts`): there only @expo/ui/swift-ui, its
 * modifiers, the stub JSX runtime and the language built-ins exist. A name from the rest of the
 * file (a constant, an import from strings.ts, a helper) stays in the string and throws a
 * ReferenceError on the device, which no other test sees (ios-adapters.test.ts mocks the layouts).
 *
 * Each file is transformed the way `npx expo export --platform ios` does it (the caller of
 * @expo/metro-config's Babel transformer, release, Hermes, React Compiler as in app.json), and the
 * free identifiers of every widget string are checked against what that runtime defines. With the
 * Hermes profile spread, `for…of` and classes stay as written (JavaScriptCore runs them); should a
 * transform rewrite them with a helper (`_objectSpread2`, …), the helper fails here as a free
 * identifier.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Node's own require: Babel and the preset load as they do in Metro, outside Jest's module registry
// (which would also run babel-jest over @react-native/babel-plugin-codegen on the way, ~3x slower).
const nodeRequire = createRequire(__filename);
const { parseSync, transformFileSync, traverse, types: t } = nodeRequire('@babel/core') as typeof import('@babel/core');

const ROOT = path.resolve(__dirname, '../../..');
const LAYOUT_DIR = path.resolve(__dirname, '../ios');
const LAYOUT_FILES = readdirSync(LAYOUT_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .sort();

/** Packages whose exports expo-widgets copies onto the extension's global object under their own names. */
const UI_MODULES = ['@expo/ui/swift-ui', '@expo/ui/swift-ui/modifiers'];

/** expo-widgets `bundle/jsx-runtime-stub.ts`: the names the automatic JSX transform writes. */
const JSX_RUNTIME = ['_jsx', '_jsxs', '_Fragment'];

/** ECMAScript built-ins a layout may use (JavaScriptCore has them all; this list is deliberate). */
const BUILT_INS = ['undefined', 'NaN', 'Infinity', 'Array', 'Boolean', 'Date', 'JSON', 'Math', 'Number', 'Object', 'String'];

const appJson = JSON.parse(readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
  expo: { experiments?: { reactCompiler?: boolean } };
};

/** @expo/metro-config `getBabelCaller` for an iOS release export. */
const IOS_RELEASE_CALLER = {
  name: 'metro',
  bundler: 'metro',
  platform: 'ios',
  isServer: false,
  isReactServer: false,
  baseUrl: '',
  routerRoot: 'app',
  isDev: false,
  engine: 'hermes',
  projectRoot: ROOT,
  isNodeModule: false,
  isHMREnabled: true,
  supportsReactCompiler: appJson.expo.experiments?.reactCompiler === true ? true : undefined,
};

interface SourceFacts {
  directives: number;
  /** Names imported from UI_MODULES under their exported name (an alias would not exist globally). */
  uiNames: Set<string>;
}

function readSource(file: string): SourceFacts {
  const ast = parseSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['typescript', 'jsx'] },
  });
  if (ast === null) throw new Error(`${file} did not parse`);
  const facts: SourceFacts = { directives: 0, uiNames: new Set() };
  traverse(ast, {
    Directive(p) {
      if (p.node.value.value === 'widget') facts.directives += 1;
    },
    ImportDeclaration(p) {
      if (!UI_MODULES.includes(p.node.source.value) || p.node.importKind === 'type') return;
      for (const specifier of p.node.specifiers) {
        if (
          t.isImportSpecifier(specifier) &&
          specifier.importKind !== 'type' &&
          t.isIdentifier(specifier.imported) &&
          specifier.imported.name === specifier.local.name
        ) {
          facts.uiNames.add(specifier.local.name);
        }
      }
    },
  });
  return facts;
}

/** The widget source strings in the transformed module (template literals holding a function). */
function widgetStrings(file: string): string[] {
  const result = transformFileSync(file, {
    babelrc: false,
    configFile: false,
    cwd: ROOT,
    root: ROOT,
    envName: 'production',
    sourceType: 'unambiguous',
    presets: [nodeRequire.resolve('babel-preset-expo', { paths: [ROOT] })],
    caller: IOS_RELEASE_CALLER,
    ast: true,
    code: false,
  });
  if (!result?.ast) throw new Error(`${file} produced no output`);
  const found: string[] = [];
  traverse(result.ast, {
    TemplateLiteral(p) {
      const cooked = p.node.quasis[0]?.value.cooked;
      if (p.node.expressions.length === 0 && typeof cooked === 'string' && cooked.startsWith('function(')) {
        found.push(cooked);
      }
    },
  });
  return found;
}

function freeIdentifiers(code: string): string[] {
  const ast = parseSync(`(${code})`, { babelrc: false, configFile: false, sourceType: 'script' });
  if (ast === null) throw new Error('widget string did not parse');
  const free = new Set<string>();
  traverse(ast, {
    ReferencedIdentifier(p) {
      if (!p.scope.hasBinding(p.node.name, true)) free.add(p.node.name);
    },
  });
  return [...free].sort();
}

describe('widget layouts only use what the extension runtime defines', () => {
  it('finds the layout files', () => {
    expect(LAYOUT_FILES).toEqual(expect.arrayContaining(['timer-activity.tsx', 'today-widget.tsx']));
  });

  it.each(LAYOUT_FILES)('%s', (name) => {
    const file = path.join(LAYOUT_DIR, name);
    const source = readSource(file);
    const strings = widgetStrings(file);
    expect(source.directives).toBeGreaterThan(0);
    // Every 'widget' function became a string: otherwise the check below would see nothing.
    expect(strings).toHaveLength(source.directives);
    const allowed = new Set([...source.uiNames, ...JSX_RUNTIME, ...BUILT_INS]);
    for (const code of strings) {
      const unknown = freeIdentifiers(code).filter((id) => !allowed.has(id));
      expect(unknown).toEqual([]);
    }
  });

  it('flags a file constant, a strings.ts import and a spread helper', () => {
    const code =
      'function(props,environment){var o=_objectSpread2({},props);' +
      'return _jsx(Text,{modifiers:[font({size:LABEL})],children:strings.title});}';
    expect(freeIdentifiers(code)).toEqual(['LABEL', 'Text', '_jsx', '_objectSpread2', 'font', 'strings']);
  });
});
