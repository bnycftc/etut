import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type DayKey, istanbulDayKey, istanbulYear } from '@/domain/istanbul-day';
import type { YksArea } from '@/domain/net';
import { buildProfile, type ExamType } from '@/domain/profile';
import { useAppState } from '@/state/app-state';
import { storeCustomExamDate, storeDailyGoal } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, CONTENT_MAX_WIDTH, Label, Row } from '@/ui/components';
import { Icon } from '@/ui/icon';
import { BirthYearStep, CountdownStep, ExamStep, GoalStep, ONBOARDING_STEPS } from '@/ui/onboarding-steps';
import { Ring } from '@/ui/ring';
import { MAX_FONT_SCALE, space, usePalette } from '@/ui/theme';

/** The brand moment's ring: three quarters, like the app icon's arc. */
const BRAND_RING = 0.75;

/**
 * First launch, in four short steps (src/ui/onboarding-steps.tsx): exam and area, the countdown,
 * the optional daily goal, the birth year (neutral, nothing pre-selected, no age hints: K-15; only
 * the year: K-19). Nothing is saved before the last step; answers never leave the device. There
 * "Başla" and "Örnek verilerle gez" weigh the same: the second saves the profile too and opens the
 * app on example data (demo mode); the student's own data stays apart. At the top of the first
 * step the brand moment: the icon's three-quarter ring around the stopwatch on the soft brand tint.
 */
export default function OnboardingScreen() {
  const { saveProfile, notifyDataChanged, enterDemo } = useAppState();
  const c = usePalette();
  const now = Date.now();
  const currentYear = istanbulYear(now);
  const today = istanbulDayKey(now);
  const [step, setStepState] = useState(0);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [examType, setExamTypeState] = useState<ExamType | null>(null);
  const [yksArea, setYksArea] = useState<YksArea | null>(null);
  const [customDay, setCustomDay] = useState<DayKey | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  // Each refused Başla reads the message out again (it sits above the buttons).
  const [blockedAttempt, setBlockedAttempt] = useState(0);
  // The refusal is written at the end of the page: scroll it into view above the fixed buttons.
  const page = useRef<ScrollView>(null);
  const setStep = (next: number) => {
    setStepState(next);
    requestAnimationFrame(() => page.current?.scrollTo({ y: 0, animated: false }));
  };
  // A date entered for one exam does not belong to another.
  const setExamType = (next: ExamType) => {
    if (next !== examType) setCustomDay(null);
    setExamTypeState(next);
  };

  const profile = buildProfile({ birthYear, examType, yksArea }, currentYear, now);
  const examMissing =
    examType === null
      ? tr.onboardingMissing.exam
      : examType === 'YKS' && yksArea === null
        ? tr.onboardingMissing.area
        : null;
  const last = step === ONBOARDING_STEPS - 1;
  // Why the step's button is still off: the first missing answer of this step.
  const missing = step === 0 ? examMissing : last && birthYear === null ? tr.onboardingMissing.birthYear : null;

  const finish = (demo: boolean) => {
    if (profile === null) return;
    const result = saveProfile(profile);
    setBlocked(result === 'age_blocked');
    if (result === 'age_blocked') {
      setBlockedAttempt((n) => n + 1);
      requestAnimationFrame(() => page.current?.scrollToEnd({ animated: false }));
      return;
    }
    // The student's own settings, written before any switch to the example data.
    if (goal !== null) storeDailyGoal(goal, istanbulDayKey(Date.now()));
    if (customDay !== null) storeCustomExamDate(profile.examType, customDay);
    if (goal !== null || customDay !== null) notifyDataChanged('settings');
    if (demo) void enterDemo(profile);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView ref={page} testID="onboarding-screen" style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {step === 0 ? (
          <View testID="onboarding-brand" style={[styles.brand, { backgroundColor: c.accentSoft, borderColor: c.heroBorder }]}>
            <Ring ratio={BRAND_RING} color={c.accent} track={c.barSoft} size={64} thickness={8}>
              <Icon name="timerFill" color={c.accent} size={26} />
            </Ring>
            {/* The screen's title (onboarding has no bar): it grows no further than a header, as the
                system's own large titles do. Unbounded, at accessibility sizes it took three lines and
                with the intro and the fixed button left no question on the first screen (IOS-10). */}
            <Label variant="largeTitle" maxFontSizeMultiplier={MAX_FONT_SCALE.header}>
              {tr.onboarding.title}
            </Label>
            <Label variant="muted">{tr.onboarding.intro}</Label>
          </View>
        ) : null}

        <Row>
          <Label testID="onboarding-step" variant="small" style={{ flex: 1 }}>
            {tr.onboarding.step(step + 1, ONBOARDING_STEPS)}
          </Label>
          {step > 0 ? (
            <Button
              compact
              testID="onboarding-back"
              kind="secondary"
              title={tr.onboarding.back}
              onPress={() => setStep(step - 1)}
            />
          ) : null}
        </Row>

        {step === 0 ? (
          <ExamStep examType={examType} yksArea={yksArea} onExam={setExamType} onArea={setYksArea} />
        ) : step === 1 && examType !== null ? (
          <CountdownStep examType={examType} customDay={customDay} today={today} onCustomDay={setCustomDay} />
        ) : step === 2 ? (
          <GoalStep goal={goal} onGoal={setGoal} />
        ) : (
          <BirthYearStep
            birthYear={birthYear}
            currentYear={currentYear}
            onBirthYear={(y) => {
              setBirthYear(y);
              setBlocked(false);
            }}
          />
        )}

        {last ? <Label variant="small">{tr.onboarding.demoHint}</Label> : null}
        {/* Aydınlatma before anything is saved, right above the buttons. */}
        <Button
          testID="onboarding-privacy"
          kind="secondary"
          title={tr.onboarding.privacyLink}
          onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc: 'aydinlatma' } })}
        />
        {/* In the page (it can be long at large text sizes), right above the fixed buttons. */}
        {blocked ? (
          <Label testID="onboarding-age-blocked" live={blockedAttempt} style={{ color: c.danger }}>
            {tr.onboarding.ageBlocked}
          </Label>
        ) : null}
      </ScrollView>
      {/* Always on screen, above the home indicator (SafeAreaView); the page scrolls above it. On
          the last step Başla and "Örnek verilerle gez" have the same size and weight. */}
      <View testID="onboarding-footer" style={[styles.footer, { backgroundColor: c.background, borderTopColor: c.border }]}>
        {last ? (
          <>
            <Button
              large
              testID="onboarding-start"
              title={tr.onboarding.start}
              disabled={profile === null}
              onPress={() => finish(false)}
            />
            <Button
              large
              testID="onboarding-demo"
              title={tr.onboarding.demo}
              disabled={profile === null}
              onPress={() => finish(true)}
            />
          </>
        ) : (
          <Button
            large
            testID="onboarding-next"
            title={tr.onboarding.next}
            disabled={step === 0 && examMissing !== null}
            onPress={() => setStep(step + 1)}
          />
        )}
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
  // iPad: the same centred column as Screen (at most CONTENT_MAX_WIDTH), not the whole window.
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  brand: { borderRadius: 20, borderWidth: 1, padding: space.lg, gap: space.sm },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // Room above the home indicator: right next to it a tap is easily lost.
    paddingBottom: space.md,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
