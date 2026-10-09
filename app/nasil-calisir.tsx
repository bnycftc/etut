import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useRef } from 'react';
import { type LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';

import {
  BACKUP_NUDGE_AFTER_DAYS,
  BACKUP_NUDGE_MIN_STUDY_DAYS,
  BACKUP_NUDGE_SNOOZE_DAYS,
} from '@/domain/backup-reminder';
import { TARGET_WINDOW } from '@/domain/exam-analysis';
import { UNDO_FINISH_MS } from '@/domain/finish';
import { LIVE_ACTIVITY_MAX_MS } from '@/domain/live-timer';
import { MANUAL_DAYS, MANUAL_MAX_MS } from '@/domain/manual-entry';
import { type ExamKind, formatNet, net, wrongsPerCorrect } from '@/domain/net';
import { DEFAULT_POMODORO } from '@/domain/pomodoro';
import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '@/domain/streak';
import { BACKGROUND_TOLERANCE_MS, LONG_SESSION_MS } from '@/domain/timer';
import { tr } from '@/strings';
import { Button, Card, Label } from '@/ui/components';
import { type GuideSection, isGuideSection } from '@/ui/info-link';
import { space, usePalette } from '@/ui/theme';

const HOUR_MS = 3_600_000;
const g = tr.guide;

/** Net rule per paper, read from domain/net.ts, with one worked example each. */
const NET_RULES: { exam: string; kind: ExamKind; example: { correct: number; wrong: number } | null }[] = [
  { exam: g.net.yks, kind: 'TYT', example: { correct: 30, wrong: 8 } },
  { exam: g.net.kpss, kind: 'KPSS_GYGK', example: null },
  { exam: g.net.lgs, kind: 'LGS', example: { correct: 15, wrong: 3 } },
];

/**
 * "Nasıl çalışır": the rules a student meets, in short plain paragraphs. Every number comes from
 * the domain module that applies the rule, so the text cannot drift from the app. Opened with
 * `?bolum=<section>` (the "Nedir?" links) it scrolls to that section and outlines it.
 */
export default function GuideScreen() {
  const c = usePalette();
  const params = useLocalSearchParams<{ bolum?: string }>();
  const target: GuideSection | null = isGuideSection(params.bolum) ? params.bolum : null;
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  const onLayout = (id: GuideSection) => (e: LayoutChangeEvent) => {
    if (id !== target || scrolled.current) return;
    scrolled.current = true;
    scroll.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - space.md), animated: false });
  };

  const section = (id: GuideSection, title: string, children: ReactNode) => (
    <Card testID={`guide-section-${id}`} outline={id === target ? c.accent : undefined}>
      <Label variant="heading">{title}</Label>
      {children}
    </Card>
  );
  const paragraphs = (texts: readonly string[]) => texts.map((text) => <Label key={text}>{text}</Label>);

  const sections: [GuideSection, ReactNode][] = [
    [
      'sayac',
      section(
        'sayac',
        g.timer.title,
        paragraphs(
          g.timer.paragraphs(BACKGROUND_TOLERANCE_MS / 1000, UNDO_FINISH_MS / 1000, LONG_SESSION_MS / HOUR_MS),
        ),
      ),
    ],
    [
      'pomodoro',
      section(
        'pomodoro',
        g.pomodoro.title,
        paragraphs(
          g.pomodoro.paragraphs(
            DEFAULT_POMODORO.workMin,
            DEFAULT_POMODORO.shortBreakMin,
            DEFAULT_POMODORO.longBreakMin,
            DEFAULT_POMODORO.longEvery,
          ),
        ),
      ),
    ],
    ['elle', section('elle', g.manual.title, paragraphs(g.manual.paragraphs(MANUAL_DAYS, MANUAL_MAX_MS / HOUR_MS)))],
    [
      'net',
      section(
        'net',
        g.net.title,
        <>
          <Label>{g.net.intro}</Label>
          {NET_RULES.map(({ exam, kind, example }) => {
            const per = wrongsPerCorrect(kind);
            return (
              <View key={kind} style={{ gap: space.xs }}>
                <Label testID={`guide-net-${kind}`} style={{ fontWeight: '600' }}>
                  {g.net.rule(exam, tr.exams.netRule(per))}
                </Label>
                {example !== null ? (
                  <Label variant="small">
                    {g.net.example(example.correct, example.wrong, per, formatNet(net(example.correct, example.wrong, kind)))}
                  </Label>
                ) : null}
              </View>
            );
          })}
          {paragraphs(g.net.more)}
        </>,
      ),
    ],
    ['analiz', section('analiz', g.analysis.title, paragraphs(g.analysis.paragraphs(TARGET_WINDOW)))],
    [
      'hedef',
      section('hedef', g.goal.title, paragraphs(g.goal.paragraphs(GOAL_MIN_MINUTES, GOAL_MAX_MINUTES / 60))),
    ],
    ['seri', section('seri', g.streak.title, paragraphs(g.streak.paragraphs))],
    ['tarih', section('tarih', g.examDate.title, paragraphs(g.examDate.paragraphs))],
    [
      'kilit',
      section(
        'kilit',
        g.lockScreen.title,
        <>
          {paragraphs(g.lockScreen.paragraphs(LIVE_ACTIVITY_MAX_MS / HOUR_MS))}
          <Label variant="heading">{g.lockScreen.widgetTitle}</Label>
          {paragraphs(g.lockScreen.widgetSteps)}
          <Label>{g.lockScreen.lockWidget}</Label>
          <Label variant="muted">{g.lockScreen.widgetInfo}</Label>
        </>,
      ),
    ],
    [
      'yedek',
      section(
        'yedek',
        g.backup.title,
        paragraphs(g.backup.paragraphs(BACKUP_NUDGE_MIN_STUDY_DAYS, BACKUP_NUDGE_AFTER_DAYS, BACKUP_NUDGE_SNOOZE_DAYS)),
      ),
    ],
  ];

  return (
    <ScrollView
      ref={scroll}
      testID="guide-screen"
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={styles.content}>
      <Label variant="muted">{g.intro}</Label>
      {sections.map(([id, node]) => (
        // The wrapper's offset is the section's own position in the list (scroll target).
        <View key={id} onLayout={onLayout(id)}>
          {node}
        </View>
      ))}
      <Button testID="guide-close" kind="secondary" title={g.close} onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
});
