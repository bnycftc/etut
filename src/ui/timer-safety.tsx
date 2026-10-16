/**
 * Timer screen helpers that protect study time: keeping the screen on while the timer runs, the
 * questions "Bitir" asks before saving, and the Settings card for both. The rules are in
 * `domain/timer.ts` (`finishQuestion`, `capStudyTime`, `AwayRule`).
 */

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  type ActiveSession,
  AWAY_COUNT_MAX_MS,
  creditAway,
  dismissAway,
  finishQuestion,
  finishSession,
  LONG_SESSION_MS,
  pendingAwayMs,
  pendingAwayStudyMs,
} from '../domain/timer';
import { type FinishOptions, useAppState, useStored } from '../state/app-state';
import { loadAwayRule, loadKeepAwake, storeAwayRule, storeKeepAwake } from '../storage/kv';
import { tr } from '../strings';
import { Button, Card, Chip, ChipRow, Label } from './components';
import { formatDuration } from './format';

const KEEP_AWAKE_TAG = 'etut-timer';

/**
 * Keeps the screen on while the timer runs and this screen is shown, if the student turned it on
 * (default off). With the away rule "Sor" an automatic screen lock would otherwise send the app to
 * the background, where the study time becomes a break.
 */
export function TimerKeepAwake({ running }: { running: boolean }): null {
  const { dataVersions } = useAppState();
  const enabled = useStored(`keepAwake|${dataVersions.settings}`, loadKeepAwake);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const on = enabled && running && focused;
  useEffect(() => {
    if (!on) return;
    // Best effort: a browser without the Wake Lock API, or a refused request, changes nothing else.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [on]);
  return null;
}

function formatAway(ms: number): string {
  return ms < 60_000 ? tr.timer.lessThanMinute : formatDuration(ms);
}

const AWAY_COUNT_HOURS = AWAY_COUNT_MAX_MS / 3_600_000;

/** The away texts of the timer card (`tr.timer`) and of the question before saving (`tr.finishCheck`). */
interface AwayTexts {
  awayTitle: (duration: string) => string;
  awayBody: string;
  awayBodyStudy: (study: string) => string;
  awayTitleCapped: (hours: number) => string;
  awayBodyCapped: (hours: number, rest: string) => string;
  awayBodyCappedStudy: (hours: number, study: string) => string;
}

/**
 * The unanswered absence in words: the time away that became a break, or the study time
 * "Çalışıyordum" adds when that reads differently (pomodoro: the breaks in it were breaks anyway).
 * Capped (rule "Çalışmaya devam say"): its first hours counted, only the rest is asked about.
 */
function awayText(session: ActiveSession, t: AwayTexts): { title: string; body: string } {
  const away = formatAway(pendingAwayMs(session));
  const study = formatAway(pendingAwayStudyMs(session));
  const same = study === away;
  if (session.pendingAway?.capped === true) {
    return {
      title: t.awayTitleCapped(AWAY_COUNT_HOURS),
      body: same ? t.awayBodyCapped(AWAY_COUNT_HOURS, away) : t.awayBodyCappedStudy(AWAY_COUNT_HOURS, study),
    };
  }
  return { title: t.awayTitle(away), body: same ? t.awayBody : t.awayBodyStudy(study) };
}

/** Title and text of the timer screen's card for an unanswered absence. */
export function awayCardText(session: ActiveSession): { title: string; body: string } {
  return awayText(session, tr.timer);
}

/**
 * "Bitir" with its questions: an unanswered absence is asked about instead of being dropped, and
 * a session longer than `LONG_SESSION_MS` is confirmed (or saved as its first 10 hours).
 * `request` goes in the button, `prompt` is shown under it while a question is open.
 * `open`: a question is shown. While an absence is open it is the one asked here, so the screen
 * hides its own away card meanwhile (the same question twice, one above the other).
 */
export function useFinishCheck(onFinish: (options?: FinishOptions) => void): {
  request: () => void;
  prompt: ReactNode;
  open: boolean;
} {
  const app = useAppState();
  const active = app.active;
  const [step, setStep] = useState<'away' | 'long' | null>(null);

  const finishOrAsk = (session: ActiveSession) => {
    const question = finishQuestion(session, Date.now());
    if (question === null) {
      setStep(null);
      onFinish();
    } else {
      setStep(question);
    }
  };

  const request = () => {
    if (active !== null) finishOrAsk(active);
  };

  const answerAway = (studied: boolean) => {
    if (active === null) return;
    if (studied) app.creditAway();
    else app.dismissAway();
    finishOrAsk(studied ? creditAway(active) : dismissAway(active));
  };

  const answerLong = (all: boolean) => {
    setStep(null);
    onFinish(all ? undefined : { maxStudyMs: LONG_SESSION_MS });
  };

  // What to ask comes from the session as it is now: an absence that is still open is asked
  // about first (also when it began while the "long" question was open); one answered on the
  // card above closes the question for good, so a later absence does not reopen it unasked.
  const pending = active?.pendingAway ?? null;
  const shown = active === null || step === null ? null : pending !== null ? 'away' : step === 'away' ? null : step;
  useEffect(() => {
    if (step !== null && (active === null || (step === 'away' && pending === null))) setStep(null);
  }, [step, active, pending]);
  const away = active === null ? null : awayText(active, tr.finishCheck);
  const prompt =
    shown === null || active === null || away === null ? null : (
      <View testID="finish-check" style={{ gap: 12 }}>
        {shown === 'away' ? (
          <>
            <Label testID="finish-check-title" style={{ fontWeight: '600' }}>
              {away.title}
            </Label>
            <Label variant="muted">{away.body}</Label>
            <Button testID="finish-away-credit" title={tr.finishCheck.awayCredit} onPress={() => answerAway(true)} />
            <Button
              testID="finish-away-break"
              kind="secondary"
              title={tr.finishCheck.awayBreak}
              onPress={() => answerAway(false)}
            />
          </>
        ) : (
          <>
            <Label testID="finish-check-title" style={{ fontWeight: '600' }}>
              {tr.finishCheck.longTitle(formatDuration(finishSession(active, Date.now()).durationMs))}
            </Label>
            <Label variant="muted">{tr.finishCheck.longBody}</Label>
            <Button testID="finish-long-all" title={tr.finishCheck.longAll} onPress={() => answerLong(true)} />
            <Button
              testID="finish-long-cap"
              kind="secondary"
              title={tr.finishCheck.longCap}
              onPress={() => answerLong(false)}
            />
          </>
        )}
        <Button
          testID="finish-check-cancel"
          kind="secondary"
          title={tr.finishCheck.cancel}
          onPress={() => setStep(null)}
        />
      </View>
    );
  return { request, prompt, open: prompt !== null };
}

/** Ayarlar: keep the screen on (default off), and what leaving the app means (default: count). */
export function TimerSettingsCard() {
  const { dataVersions, notifyDataChanged } = useAppState();
  const keepAwake = useStored(`keepAwake|${dataVersions.settings}`, loadKeepAwake);
  const awayRule = useStored(`awayRule|${dataVersions.settings}`, loadAwayRule);
  const s = tr.timerSettings;
  const setKeepAwake = (on: boolean) => {
    storeKeepAwake(on);
    notifyDataChanged('settings');
  };
  const setAwayRule = (rule: 'ask' | 'count') => {
    storeAwayRule(rule);
    notifyDataChanged('settings');
  };
  return (
    <Card testID="settings-timer">
      <Label variant="heading">{s.title}</Label>
      <Label variant="muted">{s.keepAwake}</Label>
      <ChipRow>
        <Chip
          testID="settings-keep-awake-on"
          title={s.on}
          accessibilityLabel={`${s.keepAwake}: ${s.on}`}
          selected={keepAwake}
          onPress={() => setKeepAwake(true)}
        />
        <Chip
          testID="settings-keep-awake-off"
          title={s.off}
          accessibilityLabel={`${s.keepAwake}: ${s.off}`}
          selected={!keepAwake}
          onPress={() => setKeepAwake(false)}
        />
      </ChipRow>
      <Label variant="small">{s.keepAwakeInfo}</Label>
      <Label variant="muted">{s.awayTitle}</Label>
      <ChipRow>
        <Chip
          testID="settings-away-ask"
          title={s.awayAsk}
          accessibilityLabel={`${s.awayTitle}: ${s.awayAsk}`}
          selected={awayRule === 'ask'}
          onPress={() => setAwayRule('ask')}
        />
        <Chip
          testID="settings-away-count"
          title={s.awayCount}
          accessibilityLabel={`${s.awayTitle}: ${s.awayCount}`}
          selected={awayRule === 'count'}
          onPress={() => setAwayRule('count')}
        />
      </ChipRow>
      <Label testID="settings-away-info" variant="small">
        {awayRule === 'ask' ? s.awayAskInfo : s.awayCountInfo(AWAY_COUNT_HOURS)}
      </Label>
    </Card>
  );
}
