/**
 * Declared Age Range (hukuk/03 K-17) for builds with the group module on, and nothing for the rest.
 *
 * The phase comes from the GROUPS_PHASE environment variable: .github/workflows/testflight.yml sets
 * it for the macOS job from src/config/features.ts and checks the signed app afterwards. Unset
 * means 'off', so a local `expo prebuild` / `expo config` and every 0.4.x build stay as they are:
 *
 * - 'off': the config is returned untouched. No entitlement (a new capability can break signing
 *   until it is enabled for the App ID in the Developer Portal) and the privacy manifest keeps
 *   declaring no collected data ("Data Not Collected" on the 0.4.x product page).
 * - 'beta18' / 'public':
 *   1. `com.apple.developer.declared-age-range` in the app's entitlements. expo-age-range has no
 *      config plugin of its own; without the entitlement AgeRangeService answers "not available".
 *   2. `NSPrivacyCollectedDataTypes` in the app's privacy manifest, matching App Privacy in App
 *      Store Connect: user ID, other user content, other usage data, other diagnostic data (IP
 *      address in server logs) and other data types (the age band). Linked to the user, no
 *      tracking, only for app functionality.
 *
 * Only the app target gets these; the widget extension's manifest (with-etut-ios.js) is unchanged.
 */

const PHASES = ['off', 'beta18', 'public'];
const ENTITLEMENT = 'com.apple.developer.declared-age-range';

const COLLECTED_TYPES = [
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypeOtherUsageData',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
  'NSPrivacyCollectedDataTypeOtherDataTypes',
];

function groupsPhase() {
  const phase = process.env.GROUPS_PHASE || 'off';
  if (!PHASES.includes(phase)) {
    throw new Error(`with-age-range: GROUPS_PHASE must be one of ${PHASES.join(', ')}, got '${phase}'.`);
  }
  return phase;
}

module.exports = (config) => {
  if (groupsPhase() === 'off') return config;
  const ios = config.ios ?? {};
  const manifest = ios.privacyManifests ?? {};
  return {
    ...config,
    ios: {
      ...ios,
      entitlements: { ...ios.entitlements, [ENTITLEMENT]: true },
      privacyManifests: {
        ...manifest,
        NSPrivacyCollectedDataTypes: COLLECTED_TYPES.map((type) => ({
          NSPrivacyCollectedDataType: type,
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        })),
      },
    },
  };
};
