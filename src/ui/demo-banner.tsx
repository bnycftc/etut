import { StyleSheet, View } from 'react-native';

import { tr } from '../strings';
import { Button, Label } from './components';
import { ScreenTop } from './screen-top';
import { space, usePalette } from './theme';

/**
 * The thin band at the top of every screen while the app shows example data: "Örnek veriler" and
 * Çık. Put into the `ScreenTop` slot by `AppStateProvider` (only in demo mode), so it takes no
 * app state itself.
 */
export function DemoBand({ onExit }: { onExit: () => void }) {
  const c = usePalette();
  return (
    <View testID="demo-banner" style={[styles.band, { backgroundColor: c.accentSoft, borderColor: c.heroBorder }]}>
      <Label style={styles.text}>{tr.demo.banner}</Label>
      <Button compact testID="demo-exit" kind="secondary" title={tr.demo.exit} accessibilityLabel={tr.demo.exitA11y} onPress={onExit} />
    </View>
  );
}

/**
 * The band on a screen that does not use `Screen` (its own scroll view): renders the same slot,
 * so it shows only in demo mode.
 */
export function DemoBanner() {
  return <ScreenTop />;
}

const styles = StyleSheet.create({
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  text: { flex: 1, fontWeight: '600' },
});
