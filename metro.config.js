// Expo Metro config. Native builds only use the defaults; the rest is for the web preview.
//
// expo-sqlite on web runs SQLite (wa-sqlite) in a worker and implements the synchronous API with
// SharedArrayBuffer + Atomics, so the page must be cross-origin isolated: the HTML document
// (and the worker script) need `Cross-Origin-Opener-Policy: same-origin` and
// `Cross-Origin-Embedder-Policy: credentialless` (Chrome, Edge, Firefox; Safari would need
// `require-corp`). index.web.ts then starts the worker asynchronously before the first render.
//
// The documented `server.enhanceMiddleware` hook is not enough with Expo CLI: it only wraps Metro's
// own middleware (bundles, assets). The HTML document is answered earlier by Expo CLI's
// ManifestMiddleware (`/`) and HistoryFallbackMiddleware (other routes), which never pass through
// that hook, so the page was not isolated and `SharedArrayBuffer` was undefined. The expo-router
// plugin `headers` option only ends up in the exported server manifest (EAS Hosting), not in the
// dev server. Therefore the two headers are added to every response of this dev server process.
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

const PATCHED = Symbol.for('etut.crossOriginIsolation');
if (!http.ServerResponse.prototype[PATCHED]) {
  const writeHead = http.ServerResponse.prototype.writeHead;
  http.ServerResponse.prototype.writeHead = function writeHeadWithIsolation(...args) {
    if (!this.headersSent) {
      for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
        if (!this.hasHeader(name)) this.setHeader(name, value);
      }
    }
    return writeHead.apply(this, args);
  };
  http.ServerResponse.prototype[PATCHED] = true;
}

const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports wa-sqlite.wasm as an asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
