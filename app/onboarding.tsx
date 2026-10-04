import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { istanbulYear } from '@/domain/istanbul-day';
import type { YksArea } from '@/domain/net';
import { birthYearOptions, buildProfile, EXAM_TYPES, type ExamType, YKS_AREAS } from '@/domain/profile';
import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label } from '@/ui/components';
import { space, usePalette } from '@/ui/theme';

/**
 * First launch. Neutral birth-year picker with nothing pre-selected and no age hints (K-15);
 * only the year is asked (K-19). Answers never leave the device.
 */
export default function OnboardingScreen() {
  const { saveProfile } = useAppState();
  const c = usePalette();
  const currentYear = istanbulYear(Date.now());
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [yksArea, setYksArea] = useState<YksArea | null>(null);

  const profile = buildProfile({ birthYear, examType, yksArea }, currentYear, Date.now());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView testID="onboarding-screen" contentContainerStyle={styles.content}>
        <Label variant="title">{tr.onboarding.title}</Label>
        <Label variant="muted">{tr.onboarding.intro}</Label>

        <Card>
          <Label variant="heading">{tr.onboarding.birthYearTitle}</Label>
          <Label variant="small">{tr.onboarding.birthYearHint}</Label>
          <View style={[styles.yearBox, { borderColor: c.border }]}>
            <ScrollView nestedScrollEnabled>
              <ChipRow>
                {birthYearOptions(currentYear).map((y) => (
                  <Chip
                    key={y}
                    testID={`birth-year-${y}`}
                    title={String(y)}
                    selected={y === birthYear}
                    onPress={() => setBirthYear(y)}
                  />
                ))}
              </ChipRow>
            </ScrollView>
          </View>
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

        <Button
          large
          testID="onboarding-start"
          title={tr.onboarding.start}
          disabled={profile === null}
          onPress={() => {
            if (profile !== null) saveProfile(profile);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  yearBox: { maxHeight: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: space.sm },
});
