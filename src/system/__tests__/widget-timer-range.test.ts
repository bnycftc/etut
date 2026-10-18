/// <reference types="node" />
/**
 * The dates the Home Screen widget layout (`ios/today-widget.tsx`) hands to SwiftUI.
 *
 * `Text(timerInterval:)` and `ProgressView(timerInterval:)` get `lower`/`upper` from JS `Date`s.
 * An Invalid Date (`new Date(undefined)`) reaches Swift as a NaN date; @expo/ui's `lower <= upper`
 * check lets NaN through, and SwiftUI then traps converting the NaN interval into a `Duration`
 * ("Double value cannot be converted to _Int128 because it is outside the representable range"):
 * the widget extension crashes. WidgetKit renders the placeholder with no props at all
 * (expo-widgets `placeholder(in:)`, and `getSnapshot` without a stored timeline), and the
 * timeline props reach the extension without their `null` fields (see `home-widget.ios.ts`), so
 * the layout must treat a missing time as "no live range", never as a time.
 *
 * The layout runs here as the device gets it: babel-preset-expo turns the `'widget'` function into
 * a source string (the extension evaluates it in its own JavaScriptCore context), and that string
 * is called with a recording stand-in for @expo/ui and the JSX runtime.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { WidgetEntry } from '../../domain/widget-summary';
import { emptyWidgetProps, type TodayWidgetProps, todayWidgetProps } from '../surface-props';

const nodeRequire = createRequire(__filename);
const { transformFileSync, traverse } = nodeRequire('@babel/core') as typeof import('@babel/core');

const ROOT = path.resolve(__dirname, '../../..');
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

function widgetString(file: string): string {
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
  if (found.length !== 1) throw new Error(`${file}: expected one widget string, found ${found.length}`);
  return found[0];
}

interface Node {
  type: unknown;
  props: Record<string, unknown>;
}

/** Element as expo-widgets' jsx-runtime-stub builds it (children flattened). */
function jsx(type: unknown, config: Record<string, unknown>): Node {
  const props = { ...config };
  if (Array.isArray(props.children)) props.children = props.children.flat(Infinity);
  return { type, props };
}

/**
 * Evaluates a widget string with: the JSX runtime, every capitalised name as a component tag and
 * every other unknown name as a modifier. Language built-ins (`Date`, `Number`, …) stay real.
 */
function loadLayout(code: string): (props: unknown, environment: unknown) => unknown {
  const scope = new Proxy(
    {},
    {
      has: (_target, key) => typeof key === 'string' && !(key in globalThis),
      get: (_target, key) => {
        if (key === Symbol.unscopables) return undefined;
        if (key === '_jsx' || key === '_jsxs') return jsx;
        if (key === '_Fragment') return 'Fragment';
        const name = String(key);
        return /^[A-Z]/.test(name) ? name : (...args: unknown[]) => ({ modifier: name, args });
      },
    },
  );
  // eslint-disable-next-line no-new-func -- the layout is a source string by design
  return new Function('scope', `with (scope) { return (${code}); }`)(scope);
}

const isValidDate = (d: unknown): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/** Every `timerInterval` / `pauseTime` in the tree, with what is wrong about it. */
function dateProblems(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) dateProblems(child, found);
    return found;
  }
  if (node === null || typeof node !== 'object') return found;
  const { type, props } = node as Node;
  if (props === undefined) return found;
  const range = props.timerInterval as { lower?: unknown; upper?: unknown } | undefined;
  if (range !== undefined) {
    if (!isValidDate(range.lower) || !isValidDate(range.upper)) {
      found.push(`${String(type)}: timerInterval with an invalid date (${String(range.lower)} … ${String(range.upper)})`);
    } else if (range.lower.getTime() > range.upper.getTime()) {
      found.push(`${String(type)}: timerInterval lower > upper`);
    }
  }
  if (props.pauseTime !== undefined && !isValidDate(props.pauseTime)) {
    found.push(`${String(type)}: invalid pauseTime`);
  }
  dateProblems(props.children, found);
  return found;
}

/** The props the extension sees: what the adapter stores in the App Group (no `null` values). */
function asStored(props: TodayWidgetProps): Record<string, unknown> {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== null));
}

const FAMILIES = ['systemSmall', 'systemMedium', 'accessoryRectangular'];
const environment = (widgetFamily: string) => ({
  widgetFamily,
  colorScheme: 'light',
  widgetRenderingMode: 'fullColor',
  showsContainerBackground: true,
  date: new Date(1_792_000_000_000),
});

const AT = 1_792_000_000_000;
const ENTRY: WidgetEntry = {
  at: AT,
  day: '2026-10-18',
  todayMs: 0,
  counting: false,
  goalMinutes: null,
  goalMet: false,
  goalRatio: 0,
  goalReachedAt: null,
  streakDays: null,
  countdown: null,
};

const ENTRIES: [string, WidgetEntry][] = [
  ['not counting, no goal', ENTRY],
  ['counting, goal not met', { ...ENTRY, todayMs: 1_200_000, counting: true, goalMinutes: 60, goalRatio: 1 / 3, goalReachedAt: AT + 2_400_000, streakDays: 3 }],
  ['counting, goal met', { ...ENTRY, todayMs: 4_000_000, counting: true, goalMinutes: 60, goalMet: true, goalRatio: 1, streakDays: 4, countdown: { examType: 'YKS', daysLeft: 200 } }],
  ['counting, goal reached exactly now', { ...ENTRY, todayMs: 3_600_000, counting: true, goalMinutes: 60, goalRatio: 1, goalReachedAt: AT }],
  ['paused with a goal', { ...ENTRY, todayMs: 600_000, goalMinutes: 60, goalRatio: 1 / 6, streakDays: 1 }],
];

describe('today widget: every date range it draws is valid', () => {
  const layout = loadLayout(widgetString(path.resolve(__dirname, '../ios/today-widget.tsx')));

  it.each(FAMILIES)('placeholder / snapshot without props (%s)', (family) => {
    expect(dateProblems(layout({}, environment(family)))).toEqual([]);
  });

  it('without props it reads like an empty day (same texts as emptyWidgetProps)', () => {
    const empty = emptyWidgetProps();
    const tree = JSON.stringify(layout({}, environment('systemMedium')));
    expect(tree).toContain(JSON.stringify(empty.title));
    expect(tree).toContain(JSON.stringify(empty.total));
  });

  it.each(FAMILIES)('after "Tüm verileri sil" (%s)', (family) => {
    expect(dateProblems(layout(asStored(emptyWidgetProps()), environment(family)))).toEqual([]);
  });

  describe.each(ENTRIES)('%s', (_name, entry) => {
    it('props keep start <= end', () => {
      const props = todayWidgetProps(entry);
      if (props.goalFrom !== null || props.goalTo !== null) {
        expect(props.goalFrom).not.toBeNull();
        expect(props.goalTo).not.toBeNull();
        expect(props.goalFrom as number).toBeLessThanOrEqual(props.goalTo as number);
      }
      if (props.countingFrom !== null) expect(props.countingFrom).toBeLessThanOrEqual(entry.at);
    });

    it.each(FAMILIES)('stored props (%s)', (family) => {
      expect(dateProblems(layout(asStored(todayWidgetProps(entry)), environment(family)))).toEqual([]);
    });

    it.each(FAMILIES)('props with nulls (%s)', (family) => {
      expect(dateProblems(layout(todayWidgetProps(entry), environment(family)))).toEqual([]);
    });
  });

  it('draws the live clock and goal bar from stored props while counting', () => {
    const tree = JSON.stringify(layout(asStored(todayWidgetProps(ENTRIES[1][1])), environment('systemMedium')));
    expect(tree.match(/"timerInterval"/g)).toHaveLength(2);
  });

  it('falls back to the next line when a stored text is missing', () => {
    // No streak: the Lock Screen widget shows the goal line instead (a missing key, not `null`).
    const props = asStored(todayWidgetProps({ ...ENTRY, goalMinutes: 60 }));
    expect(props.streakLine).toBeUndefined();
    const tree = JSON.stringify(layout(props, environment('accessoryRectangular')));
    expect(tree).toContain(JSON.stringify(props.goalLine));
  });
});

const mockTimelines: { date: Date; props: Record<string, unknown> }[][] = [];

jest.mock('../ios/today-widget', () => ({ TodayWidget: 'today-widget-layout' }));
jest.mock('expo-widgets', () => ({
  createWidget: () => ({
    updateTimeline: (entries: { date: Date; props: Record<string, unknown> }[]) => mockTimelines.push(entries),
  }),
}));

describe('home widget adapter: the timeline is storable in the App Group', () => {
  it('sends no null values (UserDefaults rejects NSNull and keeps no timeline at all)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded after the mocks
    const { homeWidget } = require('../home-widget.ios') as typeof import('../home-widget.ios');
    const entries = ENTRIES.map(([, e]) => ({ at: e.at, props: todayWidgetProps(e) }));
    homeWidget.setTimeline([...entries, { at: AT + 1, props: emptyWidgetProps() }]);
    expect(mockTimelines).toHaveLength(1);
    const sent = mockTimelines[0];
    expect(sent).toHaveLength(entries.length + 1);
    for (const { props } of sent) {
      expect(Object.values(props).filter((v) => v === null || v === undefined)).toEqual([]);
    }
    // Only the nulls go: every value that was set arrives unchanged.
    expect(sent[1].props).toEqual(asStored(entries[1].props));
  });
});
