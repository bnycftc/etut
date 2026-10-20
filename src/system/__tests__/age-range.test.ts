/**
 * The Declared Age Range adapter against a stand-in for expo-age-range, and the build plugin that
 * adds its entitlement and the collected-data declarations only when the group module is on.
 */

import { Platform } from 'react-native';

import { requestAgeSignal as requestOnIos } from '../age-range.ios';
import { requestAgeSignal as requestDefault } from '../age-range';

const mockModule: { calls: unknown[]; result: () => Promise<unknown> } = {
  calls: [],
  result: async () => ({ lowerBound: 15, upperBound: 17 }),
};

jest.mock('expo-age-range', () => ({
  requestAgeRangeAsync: (options: unknown) => {
    mockModule.calls.push(options);
    return mockModule.result();
  },
}));

function coded(code: string): Error {
  return Object.assign(new Error(code), { code });
}

function onIos(version: string | number) {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version as typeof Platform.Version);
}

beforeEach(() => {
  mockModule.calls = [];
  mockModule.result = async () => ({ lowerBound: 15, upperBound: 17 });
});

afterEach(() => jest.restoreAllMocks());

describe('age-range adapter', () => {
  test('Android and web report unavailable', async () => {
    await expect(requestDefault()).resolves.toBe('unavailable');
  });

  test('iOS 26 asks with the gates 15 and 18 and returns the range', async () => {
    onIos('26.0');
    await expect(requestOnIos()).resolves.toEqual({ lowerBound: 15, upperBound: 17 });
    expect(mockModule.calls).toEqual([{ threshold1: 15, threshold2: 18 }]);
  });

  test('missing bounds become null', async () => {
    onIos('26.1');
    mockModule.result = async () => ({ lowerBound: 18 });
    await expect(requestOnIos()).resolves.toEqual({ lowerBound: 18, upperBound: null });
  });

  test.each(['25.4', '18.6', 'unknown'])('iOS %s: unavailable, the module is not called (lowerBound 18 trap)', async (version) => {
    onIos(version);
    mockModule.result = async () => ({ lowerBound: 18, upperBound: null });
    await expect(requestOnIos()).resolves.toBe('unavailable');
    expect(mockModule.calls).toEqual([]);
  });

  test.each<[string, Error | string, string]>([
    ['user declined', coded('ERR_AGE_RANGE_USER_DECLINED'), 'declined'],
    ['service not available', coded('ERR_AGE_RANGE_NOT_AVAILABLE'), 'unavailable'],
    ['invalid request', coded('ERR_AGE_RANGE_INVALID_REQUEST'), 'unavailable'],
    ['no view controller', new Error('No current view controller'), 'unavailable'],
    ['a non-error rejection', 'boom', 'unavailable'],
  ])('%s → %s', async (_name, error, expected) => {
    onIos('26.2');
    mockModule.result = () => Promise.reject(error);
    await expect(requestOnIos()).resolves.toBe(expected);
  });
});

describe('plugins/with-age-range.js', () => {
  const withAgeRange = require('../../../plugins/with-age-range.js') as (config: object) => {
    ios?: { entitlements?: Record<string, unknown>; privacyManifests?: Record<string, unknown> };
  };
  const base = {
    name: 'Etüt',
    ios: {
      bundleIdentifier: 'com.bnycftc.etut',
      privacyManifests: { NSPrivacyTracking: false, NSPrivacyAccessedAPITypes: [{ x: 1 }] },
    },
  };
  const saved = process.env.GROUPS_PHASE;
  afterEach(() => {
    if (saved === undefined) delete process.env.GROUPS_PHASE;
    else process.env.GROUPS_PHASE = saved;
  });

  test.each([undefined, '', 'off'])('phase %p: config returned unchanged', (phase) => {
    if (phase === undefined) delete process.env.GROUPS_PHASE;
    else process.env.GROUPS_PHASE = phase;
    expect(withAgeRange(base)).toBe(base);
  });

  test.each(['beta18', 'public'])('phase %s: entitlement and collected data types', (phase) => {
    process.env.GROUPS_PHASE = phase;
    const ios = withAgeRange(base).ios!;
    expect(ios.entitlements).toEqual({ 'com.apple.developer.declared-age-range': true });
    expect(ios.privacyManifests).toMatchObject(base.ios.privacyManifests);
    const types = ios.privacyManifests!.NSPrivacyCollectedDataTypes as Record<string, unknown>[];
    expect(types.map((t) => t.NSPrivacyCollectedDataType)).toEqual([
      'NSPrivacyCollectedDataTypeUserID',
      'NSPrivacyCollectedDataTypeOtherUserContent',
      'NSPrivacyCollectedDataTypeOtherUsageData',
      'NSPrivacyCollectedDataTypeOtherDiagnosticData',
      'NSPrivacyCollectedDataTypeOtherDataTypes',
    ]);
    for (const t of types) {
      expect(t).toMatchObject({
        NSPrivacyCollectedDataTypeLinked: true,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
      });
    }
    expect(base.ios).not.toHaveProperty('entitlements');
  });

  test('an unknown phase fails the build', () => {
    process.env.GROUPS_PHASE = 'beta';
    expect(() => withAgeRange(base)).toThrow(/GROUPS_PHASE/);
  });
});
