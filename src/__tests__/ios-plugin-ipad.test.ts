/**
 * plugins/with-etut-ios.js: iPad gets all four orientations (UISupportedInterfaceOrientations~ipad,
 * required for iPad multitasking, ITMS-90474); the iPhone list is left as Expo wrote it (portrait).
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const withEtutIos = require('../../plugins/with-etut-ios.js');

type InfoPlistMod = (config: object) => Promise<{ modResults: Record<string, unknown> }>;

it('writes the four iPad orientations and keeps the iPhone list', async () => {
  const config = withEtutIos({ name: 'Etüt', slug: 'etut', ios: { supportsTablet: true } });
  const infoPlist = config.mods.ios.infoPlist as InfoPlistMod;
  const iphone = ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown'];
  const result = await infoPlist({
    ...config,
    modResults: {
      UISupportedInterfaceOrientations: iphone,
      'UISupportedInterfaceOrientations~ipad': iphone,
      UIRequiresFullScreen: false,
    },
    modRequest: { platform: 'ios', modName: 'infoPlist', projectRoot: '.', platformProjectRoot: 'ios' },
  });
  expect(result.modResults['UISupportedInterfaceOrientations~ipad']).toEqual([
    'UIInterfaceOrientationPortrait',
    'UIInterfaceOrientationPortraitUpsideDown',
    'UIInterfaceOrientationLandscapeLeft',
    'UIInterfaceOrientationLandscapeRight',
  ]);
  expect(result.modResults.UISupportedInterfaceOrientations).toEqual(iphone);
  expect(result.modResults).not.toHaveProperty('UIRequiresFullScreen');
});
