import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LICENSES, NATIVE_LICENSES, type PackageLicense } from '@/legal/licenses';
import { tr } from '@/strings';
import { Card, Label, Row, Screen } from '@/ui/components';

/**
 * Open-source code inside the app (generated list, see scripts/gen-licenses.mjs). Tapping a row
 * shows its license text: MIT, BSD and Apache ask for the notice to ship with the app.
 */
export default function LicensesScreen() {
  const [open, setOpen] = useState<string | null>(null);
  const item = (l: PackageLicense) => {
    const shown = open === l.name;
    return (
      <Pressable
        key={l.name}
        testID={`license-${l.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: shown }}
        accessibilityHint={tr.about.licenseHint}
        onPress={() => setOpen(shown ? null : l.name)}>
        <Row>
          <Label style={{ flex: 1 }}>{l.name}</Label>
          <Label variant="small">{l.license}</Label>
        </Row>
        <Label variant="small">{l.source === null ? l.version : `${l.version} · ${l.source}`}</Label>
        {shown ? (
          <View testID={`license-text-${l.name}`} style={{ paddingVertical: 8 }}>
            <Label variant="small">{l.text ?? tr.about.licenseTextMissing(l.license)}</Label>
          </View>
        ) : null}
      </Pressable>
    );
  };
  return (
    <Screen testID="licenses-screen">
      <Label variant="muted">{tr.about.licensesIntro(LICENSES.length, NATIVE_LICENSES.length)}</Label>
      <Card>{LICENSES.map(item)}</Card>
      <Label variant="heading">{tr.about.nativeLicenses}</Label>
      <Card>{NATIVE_LICENSES.map(item)}</Card>
    </Screen>
  );
}
