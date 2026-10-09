import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { istanbulYear } from '@/domain/istanbul-day';
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
import { space, usePalette } from '@/ui/theme';

/**
 * First launch. Neutral birth-year picker with nothing pre-selected and no age hints (K-15);
 * only the year is asked (K-19). The daily goal is optional and nothing is pre-selected either.
 * Answers never leave the device.
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
      <ScrollView testID="onboarding-screen" contentContainerStyle={styles.content}>
        <View style={styles.brand}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Label variant="title" style={{ flexShrink: 1 }}>
            {tr.onboarding.title}
          </Label>
        </View>
        <Label variant="muted">{tr.onboarding.intro}</Label>

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

        {blocked ? (
          <Label testID="onboarding-age-blocked" style={{ color: c.danger }}>
            {tr.onboarding.ageBlocked}
          </Label>
        ) : null}
        <Button
          large
          testID="onboarding-start"
          title={tr.onboarding.start}
          disabled={profile === null}
          onPress={() => {
            if (profile === null) return;
            const result = saveProfile(profile);
            setBlocked(result === 'age_blocked');
            if (result === 'ok' && goal !== null) {
              storeDailyGoal(goal);
              notifyDataChanged();
            }
          }}
        />
        {missing !== null ? (
          <Label variant="small" testID="onboarding-missing" style={{ textAlign: 'center' }}>
            {missing}
          </Label>
        ) : null}
        {/* Aydınlatma before anything is saved; below the start button so the layout above stays. */}
        <Button
          testID="onboarding-privacy"
          kind="secondary"
          title={tr.onboarding.privacyLink}
          onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc: 'aydinlatma' } })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  logo: { width: 48, height: 48, borderRadius: 11 },
});
