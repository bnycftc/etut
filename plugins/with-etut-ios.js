/**
 * Etüt's own iOS adjustments, applied after every other config plugin.
 *
 * KEEP THIS PLUGIN FIRST in app.json "plugins": Expo chains the mods so that the first listed
 * plugin's mods run last, after expo-widgets and expo-notifications have written theirs
 * (checked with `npx expo config --type introspect`).
 *
 * 1. No push. expo-widgets 57.0.x adds `aps-environment` to the app entitlements even with
 *    `enablePushNotifications: false`, and the expo-notifications plugin adds it too. Etüt only
 *    uses local notifications and local Live Activity updates, which need neither the APNs
 *    entitlement nor the Push Notifications capability, so the key is removed (hukuk/03 K-16:
 *    no push token). The CI workflows fail if it ever comes back.
 * 2. The widget extension's build number follows the app. expo-widgets writes a literal
 *    `CFBundleVersion` ("1") into ExpoWidgetsTarget/Info.plist; App Store Connect expects an
 *    extension to carry the same CFBundleVersion as its app, which CI sets through
 *    CURRENT_PROJECT_VERSION.
 * 3. The widget extension gets its own privacy manifest (ExpoWidgetsTarget/PrivacyInfo.xcprivacy,
 *    in the target's Resources). Apple asks one of every bundle whose code uses "required reason"
 *    APIs (ITMS-91053 "Missing API declaration" otherwise). expo-widgets writes none, and React
 *    Native merges the pods' manifests into the app's manifest only (privacy_manifest_utils.rb
 *    takes application targets), while the extension binary links React Native, ExpoModulesCore,
 *    ExpoWidgets and ExpoUI. Declared, as React Native declares them for itself:
 *    - UserDefaults 1C8F.1 (the App Group suite read by expo-widgets' WidgetsStorage) and CA92.1;
 *    - FileTimestamp C617.1 and SystemBootTime 35F9.1 (React Native core).
 *    No tracking, no collected data. The app's own manifest gets 1C8F.1 from app.json
 *    `ios.privacyManifests` (the app writes the App Group suite the widget reads).
 */

const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist, withXcodeProject } = require('expo/config-plugins');

const WIDGET_TARGET = 'ExpoWidgetsTarget';
const PRIVACY_MANIFEST = 'PrivacyInfo.xcprivacy';

const reasons = (type, codes) =>
  `\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>${type}</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array>
${codes.map((code) => `\t\t\t\t<string>${code}</string>`).join('\n')}
\t\t\t</array>
\t\t</dict>`;

const EXTENSION_PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
${[
  reasons('NSPrivacyAccessedAPICategoryUserDefaults', ['1C8F.1', 'CA92.1']),
  reasons('NSPrivacyAccessedAPICategoryFileTimestamp', ['C617.1']),
  reasons('NSPrivacyAccessedAPICategorySystemBootTime', ['35F9.1']),
].join('\n')}
\t</array>
</dict>
</plist>
`;

const withoutPushEntitlement = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });

const withExtensionBuildNumber = (config) =>
  withDangerousMod(config, [
    'ios',
    async (mod) => {
      const plist = path.join(mod.modRequest.platformProjectRoot, WIDGET_TARGET, 'Info.plist');
      if (fs.existsSync(plist)) {
        const xml = fs.readFileSync(plist, 'utf8');
        const next = xml.replace(
          /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
          (_, open, close) => `${open}$(CURRENT_PROJECT_VERSION)${close}`,
        );
        if (next !== xml) fs.writeFileSync(plist, next);
      }
      return mod;
    },
  ]);

const withExtensionPrivacyFile = (config) =>
  withDangerousMod(config, [
    'ios',
    async (mod) => {
      // expo-widgets recreates the folder in its own dangerous mod, which runs before this one.
      const dir = path.join(mod.modRequest.platformProjectRoot, WIDGET_TARGET);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, PRIVACY_MANIFEST), EXTENSION_PRIVACY_MANIFEST);
      return mod;
    },
  ]);

/** The extension target's own Resources phase (xcode's lookup by name would return the app's). */
function resourcesPhaseOf(project, targetUuid) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  const section = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
  const existing = (target.buildPhases ?? []).find((phase) => section[phase.value] !== undefined);
  if (existing) return section[existing.value];
  return project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetUuid).buildPhase;
}

const withExtensionPrivacyInProject = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const targetUuid = project.findTargetKey(WIDGET_TARGET);
    const group = project.pbxGroupByName(WIDGET_TARGET);
    if (!targetUuid || !group) {
      throw new Error(`with-etut-ios: no ${WIDGET_TARGET} target/group (expo-widgets must be in "plugins").`);
    }
    if (group.children.some((child) => child.comment === PRIVACY_MANIFEST)) return mod;
    const objects = project.hash.project.objects;
    const fileRef = project.generateUuid();
    const buildFile = project.generateUuid();
    // Path relative to the ExpoWidgetsTarget group (path = ExpoWidgetsTarget), like its other files.
    objects.PBXFileReference[fileRef] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'text.xml',
      path: PRIVACY_MANIFEST,
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[`${fileRef}_comment`] = PRIVACY_MANIFEST;
    objects.PBXBuildFile[buildFile] = { isa: 'PBXBuildFile', fileRef, fileRef_comment: PRIVACY_MANIFEST };
    objects.PBXBuildFile[`${buildFile}_comment`] = `${PRIVACY_MANIFEST} in Resources`;
    resourcesPhaseOf(project, targetUuid).files.push({ value: buildFile, comment: `${PRIVACY_MANIFEST} in Resources` });
    group.children.push({ value: fileRef, comment: PRIVACY_MANIFEST });
    return mod;
  });

module.exports = (config) =>
  withExtensionPrivacyInProject(
    withExtensionPrivacyFile(withExtensionBuildNumber(withoutPushEntitlement(config))),
  );
