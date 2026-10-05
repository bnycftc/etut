import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, useColorScheme, useWindowDimensions, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

import { activeSpan, type SessionSpan } from '@/domain/daily-totals';
import { DAY_MS, dayStartMs } from '@/domain/istanbul-day';
import { canShareCard, type CardPeriod, dailyCard, weeklyCard } from '@/domain/share-card';
import { weekStartOf } from '@/domain/streak';
import { isPaused } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { useStudyStats } from '@/state/study-stats';
import { shareImage } from '@/storage/file-io';
import { sessionsOverlapping } from '@/storage/sessions';
import { tr } from '@/strings';
import { Button, Chip, ChipRow, Label, Screen } from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { CARD_EXPORT, type CardScheme, StudyCardView } from '@/ui/study-card';
import { space } from '@/ui/theme';

/** Daily / weekly 9:16 study card, shared as a PNG through the system share sheet. */
export default function ShareCardScreen() {
  const { active, dataVersion, profile } = useAppState();
  const now = useNow(active !== null && !isPaused(active), 30_000);
  const stats = useStudyStats(now);
  const system = useColorScheme();
  const [period, setPeriod] = useState<CardPeriod>('day');
  const [scheme, setScheme] = useState<CardScheme>(system === 'dark' ? 'dark' : 'light');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - space.lg * 2, 360);

  const weekStart = weekStartOf(stats.today);
  const stored = useStored(`${weekStart}|${stats.today}|${dataVersion}`, () =>
    sessionsOverlapping(dayStartMs(weekStart), dayStartMs(stats.today) + DAY_MS),
  );
  const spans: SessionSpan[] = [...stored];
  if (active !== null) spans.push(activeSpan(active, now));
  const streak = stats.streak?.current ?? null;
  const card =
    period === 'day'
      ? dailyCard(spans, stats.today, stats.goal, streak)
      : weeklyCard(spans, weekStart, stats.goal, streak);

  const share = async () => {
    if (cardRef.current === null || busy) return;
    setBusy(true);
    setMessage(null);
    let uri: string | null = null;
    try {
      uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
        ...CARD_EXPORT,
      });
      if ((await shareImage(uri, tr.share.shareTitle)) === 'unavailable') setMessage(tr.share.unavailable);
    } catch {
      setMessage(tr.share.failed);
    } finally {
      if (uri !== null) releaseCapture(uri);
      setBusy(false);
    }
  };

  // Under 15 the card is not offered (ADR-001); a deep link to this screen goes back to the timer.
  if (!canShareCard(profile)) return <Redirect href="/" />;

  return (
    <Screen testID="share-screen">
      <Label variant="muted">{tr.share.intro}</Label>
      <Label variant="heading">{tr.share.period}</Label>
      <ChipRow>
        <Chip testID="share-period-day" title={tr.share.day} selected={period === 'day'} onPress={() => setPeriod('day')} />
        <Chip
          testID="share-period-week"
          title={tr.share.week}
          selected={period === 'week'}
          onPress={() => setPeriod('week')}
        />
      </ChipRow>
      <Label variant="heading">{tr.share.theme}</Label>
      <ChipRow>
        <Chip
          testID="share-theme-light"
          title={tr.share.light}
          selected={scheme === 'light'}
          onPress={() => setScheme('light')}
        />
        <Chip
          testID="share-theme-dark"
          title={tr.share.dark}
          selected={scheme === 'dark'}
          onPress={() => setScheme('dark')}
        />
      </ChipRow>

      <View
        testID="share-card-preview"
        accessible
        accessibilityRole="image"
        accessibilityLabel={tr.share.a11y(
          period === 'day' ? tr.share.cardDay : tr.share.cardWeek,
          formatDuration(card.totalMs),
        )}
        style={{ alignItems: 'center' }}>
        <StudyCardView ref={cardRef} card={card} scheme={scheme} width={cardWidth} />
      </View>

      {message !== null ? (
        <Label testID="share-message" variant="muted">
          {message}
        </Label>
      ) : null}
      <Button large testID="share-card-share" title={tr.share.share} disabled={busy} onPress={share} />
    </Screen>
  );
}
