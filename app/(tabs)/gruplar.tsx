import { tr } from '@/strings';
import { Card, Label, Screen } from '@/ui/components';

/** Placeholder only. Shown solely to 15+ profiles (see (tabs)/_layout.tsx). */
export default function GroupsScreen() {
  return (
    <Screen>
      <Card>
        <Label variant="title">{tr.groups.soon}</Label>
        <Label variant="muted">{tr.groups.body}</Label>
      </Card>
    </Screen>
  );
}
