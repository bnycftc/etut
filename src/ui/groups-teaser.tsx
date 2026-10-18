import { useState } from 'react';
import { View } from 'react-native';

import { ageBandFor, groupsAllowedForExam } from '../domain/groups';
import { istanbulYear } from '../domain/istanbul-day';
import type { Profile } from '../domain/profile';
import { tr } from '../strings';
import { Card, Label, Screen } from './components';
import { Icon, type IconName } from './icon';
import { Ring } from './ring';
import { space, usePalette } from './theme';

const t = tr.groupsTeaser;

const FEATURES: readonly [keyof typeof t.features, IconName][] = [
  ['invite', 'invite'],
  ['live', 'live'],
  ['weekly', 'weekly'],
  ['cheers', 'cheers'],
];

/**
 * "Yakında": the Groups tab of a 15+ profile while the group module is off (GROUPS_ENABLED).
 * Words and pictures only: nothing here imports src/sync, reads or stores anything, or offers a
 * control that could open an account (src/ui/__tests__/groups-teaser.test.tsx). Under 15 there is
 * no tab at all (K-16).
 */
export function GroupsTeaser({ profile }: { profile: Profile }) {
  const c = usePalette();
  // The year as the screen opens (a birthday mid-visit changes nothing that matters here).
  const [year] = useState(() => istanbulYear(Date.now()));
  const teen = ageBandFor(profile.birthYear, year) === '15_17';
  return (
    <Screen testID="groups-teaser">
      <Card tone="hero">
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Hero />
          <View
            testID="groups-teaser-badge"
            style={{ backgroundColor: c.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Label variant="small" style={{ color: c.accent, fontWeight: '700' }}>
              {t.badge}
            </Label>
          </View>
          <Label variant="largeTitle" style={{ textAlign: 'center' }}>
            {t.title}
          </Label>
          <Label variant="muted" style={{ textAlign: 'center' }}>
            {t.lead}
          </Label>
        </View>
      </Card>

      {groupsAllowedForExam(profile.examType) ? null : (
        <Card testID="groups-teaser-lgs">
          <Label variant="muted">{t.lgs}</Label>
        </Card>
      )}

      <Card>
        {FEATURES.map(([key, icon]) => (
          <Feature key={key} testID={`groups-teaser-${key}`} icon={icon} title={t.features[key].title} body={t.features[key].body} />
        ))}
      </Card>

      {teen ? (
        <Card testID="groups-teaser-parent">
          <Label variant="small" style={{ color: c.accent, fontWeight: '700' }}>
            {t.parent.kicker}
          </Label>
          <Feature icon="home" title={t.parent.title} body={t.parent.body} />
          <View style={{ gap: space.xs, paddingLeft: 48 }}>
            {t.parent.sees.map((line) => (
              <Label key={line}>{`• ${line}`}</Label>
            ))}
            <Label variant="muted">{t.parent.notSees}</Label>
          </View>
          <Label variant="muted">{t.parent.control}</Label>
        </Card>
      ) : null}

      <Card testID="groups-teaser-not-open">
        <Feature icon="privacy" title={t.notOpenTitle} body={t.notOpenBody} />
        {teen ? <Label variant="muted">{t.teen}</Label> : null}
        <Label variant="muted">{t.data}</Label>
      </Card>
    </Screen>
  );
}

/** The app's ring ("halka"), not yet closed, around the groups symbol. Decorative: the title says what this is. */
function Hero() {
  const c = usePalette();
  return (
    <Ring ratio={0.75} color={c.accent} track={c.barSoft} size={88} thickness={10}>
      <Icon name="groupsFill" color={c.accent} size={32} />
    </Ring>
  );
}

function Feature({ icon, title, body, testID }: { icon: IconName; title: string; body: string; testID?: string }) {
  const c = usePalette();
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} color={c.accent} size={18} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Label variant="heading">{title}</Label>
        <Label variant="muted">{body}</Label>
      </View>
    </View>
  );
}
