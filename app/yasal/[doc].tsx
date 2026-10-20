import { Stack, useLocalSearchParams } from 'expo-router';

import { GROUPS_ENABLED } from '@/config/features';
import type { LegalBlock, LegalPage } from '@/legal/pages/_shared';
import { page as groupPrivacy } from '@/legal/pages/gizlilik';
import { page as groupTerms } from '@/legal/pages/kullanim';
import { LEGAL_DOC_IDS, LEGAL_UPDATED, type LegalDocId, tr } from '@/strings';
import { Card, Label, Screen } from '@/ui/components';

/**
 * The group-version pages (src/legal/pages, the same modules as the web site) that the Gruplar
 * sign-up links to before the terms are accepted. Only while the group module is on.
 */
const GROUP_PAGES = new Map<string, LegalPage>([
  ['gruplar-kullanim', groupTerms],
  ['gruplar-gizlilik', groupPrivacy],
]);

/** "[metin](hedef)" links of the page format, as their text only. */
const plain = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <Label>{plain(block)}</Label>;
  if ('list' in block) {
    return (
      <>
        {block.list.map((item) => (
          <Label key={item}>{`• ${plain(item)}`}</Label>
        ))}
      </>
    );
  }
  const { head, rows } = block.table;
  return (
    <>
      {rows.map((row) => (
        <Label key={row.join('|')}>{row.map((cell, i) => `${head[i] ?? ''}: ${plain(cell)}`).join('\n')}</Label>
      ))}
    </>
  );
}

function GroupPageScreen({ id, page }: { id: string; page: LegalPage }) {
  return (
    <Screen testID={`legal-${id}`}>
      <Stack.Screen options={{ title: page.title }} />
      <Label variant="title">{page.title}</Label>
      <Label variant="small">{tr.about.updated(page.updated)}</Label>
      {page.intro !== undefined ? (
        <Card>
          {page.intro.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </Card>
      ) : null}
      {page.sections.map((s) => (
        <Card key={s.heading}>
          <Label variant="heading">{s.heading}</Label>
          {s.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </Card>
      ))}
    </Screen>
  );
}

/** One legal text: kısa aydınlatma, gizlilik politikası or kullanım şartları. */
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const groupPage = GROUPS_ENABLED && doc !== undefined ? GROUP_PAGES.get(doc) : undefined;
  if (groupPage !== undefined && doc !== undefined) return <GroupPageScreen id={doc} page={groupPage} />;
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
