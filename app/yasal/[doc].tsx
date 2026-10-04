import { Stack, useLocalSearchParams } from 'expo-router';

import { LEGAL_DOC_IDS, LEGAL_UPDATED, type LegalDocId, tr } from '@/strings';
import { Card, Label, Screen } from '@/ui/components';

/** One legal text: kısa aydınlatma, gizlilik politikası or kullanım şartları. */
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const id: LegalDocId = (LEGAL_DOC_IDS as string[]).includes(doc ?? '') ? (doc as LegalDocId) : 'aydinlatma';
  const text = tr.legal[id];
  return (
    <Screen testID={`legal-${id}`}>
      <Stack.Screen options={{ title: text.title }} />
      <Label variant="title">{text.title}</Label>
      <Label variant="small">{tr.about.updated(LEGAL_UPDATED)}</Label>
      {text.sections.map((s) => (
        <Card key={s.heading}>
          <Label variant="heading">{s.heading}</Label>
          {s.paragraphs.map((p) => (
            <Label key={p}>{p}</Label>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
