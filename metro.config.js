// Default Expo Metro config. `wasm` lets expo-sqlite's web build bundle; it still needs a
// cross-origin isolated page (COOP/COEP headers) to run, which the local dev server does not
// provide. Web is not a target in v0. Native builds are unaffected.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
