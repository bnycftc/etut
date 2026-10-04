import { View } from 'react-native';

import { LICENSES } from '@/legal/licenses';
import { tr } from '@/strings';
import { Card, Label, Row, Screen } from '@/ui/components';

/** Open-source packages inside the app (generated list, see scripts/gen-licenses.mjs). */
export default function LicensesScreen() {
  return (
    <Screen testID="licenses-screen">
      <Label variant="muted">{tr.about.licensesIntro(LICENSES.length)}</Label>
      <Card>
        {LICENSES.map((l) => (
          <View key={l.name}>
            <Row>
              <Label style={{ flex: 1 }}>{l.name}</Label>
              <Label variant="small">{l.license}</Label>
            </Row>
            <Label variant="small">{l.version}</Label>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
