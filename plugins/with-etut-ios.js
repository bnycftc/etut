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
 */

const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist } = require('expo/config-plugins');

const WIDGET_TARGET = 'ExpoWidgetsTarget';

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

module.exports = (config) => withExtensionBuildNumber(withoutPushEntitlement(config));
