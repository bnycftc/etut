import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { istanbulDayKey, istanbulYear } from '@/domain/istanbul-day';
import type { YksArea } from '@/domain/net';
import {
  BIRTH_YEAR_FIRST_PAGE_MAX_AGE,
  birthYearOptions,
  buildProfile,
  EXAM_TYPES,
  type ExamType,
  YKS_AREAS,
} from '@/domain/profile';
import { useAppState } from '@/state/app-state';
import { storeDailyGoal } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label } from '@/ui/components';
import { GoalPresets } from '@/ui/goal-sheet';
import { Icon } from '@/ui/icon';
import { Ring } from '@/ui/ring';
import { space, usePalette } from '@/ui/theme';

/** The brand moment's ring: three quarters, like the app icon's arc. */
const BRAND_RING = 0.75;

/**
 * First launch. Neutral birth-year picker with nothing pre-selected and no age hints (K-15);
 * only the year is asked (K-19). The daily goal is optional and nothing is pre-selected either.
 * Answers never leave the device. At the top the brand moment: the icon's three-quarter ring
 * around the stopwatch on the soft brand tint; Başla stays at the bottom of the screen.
 */
export default function OnboardingScreen() {
  const { saveProfile, notifyDataChanged } = useAppState();
  const c = usePalette();
  const currentYear = istanbulYear(Date.now());
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [allYears, setAllYears] = useState(false);
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [yksArea, setYksArea] = useState<YksArea | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  // Each refused Başla reads the message out again (it sits above the button).
  const [blockedAttempt, setBlockedAttempt] = useState(0);
  // The refusal is written at the end of the page: scroll it into view above the fixed Başla.
  const page = useRef<ScrollView>(null);

  const profile = buildProfile({ birthYear, examType, yksArea }, currentYear, Date.now());
  // Why Başla is still off: the first missing answer, in screen order.
  const missing =
    birthYear === null
      ? tr.onboardingMissing.birthYear
      : examType === null
        ? tr.onboardingMissing.exam
        : examType === 'YKS' && yksArea === null
          ? tr.onboardingMissing.area
          : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView ref={page} testID="onboarding-screen" style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View testID="onboarding-brand" style={[styles.brand, { backgroundColor: c.accentSoft, borderColor: c.heroBorder }]}>
          <Ring ratio={BRAND_RING} color={c.accent} track={c.barSoft} size={64} thickness={8}>
            <Icon name="timerFill" color={c.accent} size={26} />
          </Ring>
          <Label variant="largeTitle">{tr.onboarding.title}</Label>
          <Label variant="muted">{tr.onboarding.intro}</Label>
        </View>

        <Card>
          <Label variant="heading">{tr.onboarding.birthYearTitle}</Label>
          <Label variant="small">{tr.onboarding.birthYearHint}</Label>
          {/* Part of the page, not a box that scrolls on its own: a swipe in the middle of the
              screen then scrolled the year list instead of the page, hiding the cards below. */}
          <ChipRow>
            {birthYearOptions(currentYear)
              .filter((y) => allYears || currentYear - y <= BIRTH_YEAR_FIRST_PAGE_MAX_AGE || y === birthYear)
              .map((y) => (
                <Chip
                  key={y}
                  testID={`birth-year-${y}`}
                  title={String(y)}
                  selected={y === birthYear}
                  onPress={() => {
                    setBirthYear(y);
                    setBlocked(false);
                  }}
                />
              ))}
          </ChipRow>
          {allYears ? null : (
            <Button
              testID="birth-year-more"
              kind="secondary"
              title={tr.onboarding.olderYears}
              onPress={() => setAllYears(true)}
            />
          )}
        </Card>

        <Card>
          <Label variant="heading">{tr.onboarding.examTitle}</Label>
          <ChipRow>
            {EXAM_TYPES.map((t) => (
              <Chip
                key={t}
                testID={`exam-type-${t}`}
                title={tr.examType(t)}
                selected={t === examType}
                onPress={() => setExamType(t)}
              />
            ))}
          </ChipRow>
        </Card>

        {examType === 'YKS' ? (
          <Card>
            <Label variant="heading">{tr.onboarding.areaTitle}</Label>
            <ChipRow>
              {YKS_AREAS.map((a) => (
                <Chip
                  key={a}
                  testID={`yks-area-${a}`}
                  title={tr.yksArea(a)}
                  selected={a === yksArea}
                  onPress={() => setYksArea(a)}
                />
              ))}
            </ChipRow>
          </Card>
        ) : null}

        {/* Optional: skipping it is simply not choosing. Tapping the chosen one again clears it. */}
        <Card>
          <Label variant="heading">{tr.goalSheet.onboardingTitle}</Label>
          <GoalPresets
            goal={goal}
            onPick={(minutes) => setGoal(goal === minutes ? null : minutes)}
            testIDPrefix="onboarding-goal"
          />
          <Label variant="small">{tr.goalSheet.onboardingHint}</Label>
        </Card>

        {/* Aydınlatma before anything is saved, right above the start button. */}
        <Button
          testID="onboarding-privacy"
          kind="secondary"
          title={tr.onboarding.privacyLink}
          onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc: 'aydinlatma' } })}
        />
        {/* In the page (it can be long at large text sizes), right above the fixed Başla. */}
        {blocked ? (
          <Label testID="onboarding-age-blocked" live={blockedAttempt} style={{ color: c.danger }}>
            {tr.onboarding.ageBlocked}
          </Label>
        ) : null}
      </ScrollView>
      {/* Always on screen, above the home indicator (SafeAreaView); the page scrolls above it. */}
      <View style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.border }]}>
        <Button
          large
          testID="onboarding-start"
          title={tr.onboarding.start}
          disabled={profile === null}
          onPress={() => {
            if (profile === null) return;
            const result = saveProfile(profile);
            setBlocked(result === 'age_blocked');
            if (result === 'age_blocked') {
              setBlockedAttempt((n) => n + 1);
              requestAnimationFrame(() => page.current?.scrollToEnd({ animated: false }));
            }
            if (result === 'ok' && goal !== null) {
              storeDailyGoal(goal, istanbulDayKey(Date.now()));
              notifyDataChanged('settings');
            }
          }}
        />
        {missing !== null ? (
          <Label variant="small" testID="onboarding-missing" style={{ textAlign: 'center' }}>
            {missing}
          </Label>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  brand: { borderRadius: 20, borderWidth: 1, padding: space.lg, gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // Room above the home indicator: right next to it a tap is easily lost.
    paddingBottom: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
