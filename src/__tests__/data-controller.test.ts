/**
 * The data controller is not in this public repository: release builds get it from the
 * EXPO_PUBLIC_DATA_CONTROLLER_* variables (GitHub secrets, .github/workflows/testflight.yml).
 */

const KEYS = [
  'EXPO_PUBLIC_DATA_CONTROLLER_NAME',
  'EXPO_PUBLIC_DATA_CONTROLLER_ADDRESS',
  'EXPO_PUBLIC_DATA_CONTROLLER_CONTACT',
] as const;

function loadStrings(env: Partial<Record<(typeof KEYS)[number], string>>) {
  const saved = KEYS.map((k) => process.env[k]);
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    let mod: typeof import('../strings') | undefined;
    jest.isolateModules(() => {
      mod = require('../strings');
    });
    return mod!;
  } finally {
    KEYS.forEach((k, i) => {
      if (saved[i] === undefined) delete process.env[k];
      else process.env[k] = saved[i];
    });
  }
}

it('without the build variables every field is the placeholder', () => {
  const { DATA_CONTROLLER, DATA_CONTROLLER_PLACEHOLDER } = loadStrings({});
  expect(DATA_CONTROLLER).toEqual({
    name: DATA_CONTROLLER_PLACEHOLDER,
    address: DATA_CONTROLLER_PLACEHOLDER,
    contact: DATA_CONTROLLER_PLACEHOLDER,
  });
});

it('the release build shows the values it was built with, in the legal texts too', () => {
  const { DATA_CONTROLLER, tr } = loadStrings({
    EXPO_PUBLIC_DATA_CONTROLLER_NAME: 'Ad Soyad',
    EXPO_PUBLIC_DATA_CONTROLLER_ADDRESS: 'İlçe / İl',
    EXPO_PUBLIC_DATA_CONTROLLER_CONTACT: 'destek@ornek.com',
  });
  expect(DATA_CONTROLLER).toEqual({ name: 'Ad Soyad', address: 'İlçe / İl', contact: 'destek@ornek.com' });
  const legal = JSON.stringify(tr);
  expect(legal).toContain('Ad Soyad · İlçe / İl · destek@ornek.com');
  expect(legal).not.toContain('[DOLDURULACAK]');
});
