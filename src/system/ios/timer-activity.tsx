/**
 * Lock Screen / Dynamic Island layout of the study timer (iOS Live Activity, expo-widgets).
 *
 * The function below carries the `'widget'` directive: the bundler turns it into a string that
 * runs in the widget extension's own JavaScript runtime. It may only use @expo/ui/swift-ui
 * components and modifiers, its props and its environment — nothing else from this file or the
 * app (no strings.ts, no helpers, no hooks). Keep the body to plain expressions: syntax that
 * Babel rewrites with helper functions (object/array spread, for…of, classes) would reference
 * helpers that do not exist in that runtime.
 *
 * The clock is drawn by the system (`Text` with `timerInterval`), so the app sends an update
 * only when something changes. After `staleDate` (end of the pomodoro phase) the system marks the
 * activity stale and the layout switches to the next phase on its own. That works for one phase
 * only: without push nothing can change the activity while the app is closed, so the next phase is
 * shown with its end time ("Kısa mola · bitiş 10:30"), which stays true once its clock is at 0:00.
 * The app updates it at every phase change while it is open and when it goes to the background.
 * Going to the background, that last update also carries the away fields (stale 10 s after leaving
 * with the away rule "Sor", 3 hours later with "Çalışmaya devam say"): once stale, the layout shows
 * those first (frozen clock, pause icon, "Uygulamadan çıktın · mola sayılıyor"), because from then
 * on the time away is a break unless the student says otherwise.
 * The away fields are checked with `typeof`: a Live Activity started by an older app version has
 * none at all (`undefined`, not `null`). With them, the status has its own line under the clock
 * (up to two lines: "Uygulamadan çıktın · 10 sn sonra mola sayılır" until stale). On the iOS
 * simulator the stale layout was never drawn (E2E run 37): that status is what it shows.
 *
 * The icon is drawn in the subject's colour (`iconColor` / `iconColorDark`), the progress in the one
 * brand blue. The banner's goal ring fills by itself while study time counts towards the goal
 * (`goalFrom`…`goalTo`), otherwise it shows `goalRatio`; it is left out once stale (a break or the
 * time away would have stopped it, which nothing can draw without the app). Fields an older
 * activity does not carry are checked with `typeof`, as the away fields are.
 */

import { Gauge, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityEnvironment } from 'expo-widgets';

import type { TimerActivityProps } from '../surface-props';

export const TimerActivity = (props: TimerActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const awayKnown =
    typeof props.awayAt === 'number' && typeof props.awayFrom === 'number' && typeof props.awayTo === 'number';
  const away = environment.isStale === true && awayKnown;
  const showNext =
    !away &&
    environment.isStale === true &&
    props.nextStatus !== null &&
    props.nextFrom !== null &&
    props.nextTo !== null;
  const status = away ? props.awayStatus : showNext ? props.nextStatus : props.status;
  const icon = away ? 'pause.fill' : showNext && props.nextIcon !== null ? props.nextIcon : props.icon;
  const lower = new Date(
    away ? (props.awayFrom ?? props.from) : showNext ? (props.nextFrom ?? props.from) : props.from,
  );
  const upper = new Date(away ? (props.awayTo ?? props.to) : showNext ? (props.nextTo ?? props.to) : props.to);
  const pauseTime = away
    ? new Date(props.awayAt ?? props.from)
    : !showNext && props.pausedAt !== null
      ? new Date(props.pausedAt)
      : undefined;
  const countsDown = showNext ? true : props.countsDown;
  const accent = environment.isLuminanceReduced === true ? '#FFFFFF' : '#5C7CFA';
  const subjectKnown = typeof props.iconColor === 'string' && typeof props.iconColorDark === 'string';
  // The Dynamic Island is always black; the banner follows the Lock Screen's scheme.
  const islandTint =
    environment.isLuminanceReduced === true || !subjectKnown ? accent : props.iconColorDark;
  const bannerTint =
    environment.isLuminanceReduced === true || !subjectKnown
      ? accent
      : environment.colorScheme === 'dark'
        ? props.iconColorDark
        : props.iconColor;
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

  const clock = (size: number, maxWidth: number) => (
    <Text
      timerInterval={{ lower: lower, upper: upper }}
      countsDown={countsDown}
      pauseTime={pauseTime}
      modifiers={
        maxWidth > 0
          ? [font({ size: size, weight: 'semibold', design: 'rounded' }), monospacedDigit(), frame({ maxWidth: maxWidth, alignment: 'trailing' })]
          : [font({ size: size, weight: 'semibold', design: 'rounded' }), monospacedDigit()]
      }
    />
  );

  const progress = away || !props.showProgress ? null : !showNext && pauseTime !== undefined ? (
    <ProgressView value={props.progress} modifiers={[foregroundStyle(accent)]} />
  ) : (
    <ProgressView timerInterval={{ lower: lower, upper: upper }} countsDown={false} />
  );

  const goalLive = typeof props.goalFrom === 'number' && typeof props.goalTo === 'number';
  const ring =
    environment.isStale === true || typeof props.goalRatio !== 'number' ? null : goalLive ? (
      <ProgressView
        timerInterval={{ lower: new Date(props.goalFrom ?? props.from), upper: new Date(props.goalTo ?? props.to) }}
        countsDown={false}
        modifiers={[progressViewStyle('circular'), tint(accent), frame({ width: 44, height: 44 })]}
      />
    ) : (
      <Gauge value={props.goalRatio} modifiers={[gaugeStyle('circularCapacity'), tint(accent)]} />
    );

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={8}>
          <Image systemName={icon} size={15} color={bannerTint} />
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          {awayKnown ? null : <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>{status}</Text>}
        </HStack>
        {ring === null ? (
          clock(40, 0)
        ) : (
          <HStack spacing={12}>
            {clock(40, 0)}
            <Spacer />
            {ring}
          </HStack>
        )}
        {awayKnown ? <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>{status}</Text> : null}
        {progress}
        {away ? <Text modifiers={[font({ size: 12 }), secondary, lineLimit(1)]}>{props.awayHint}</Text> : null}
      </VStack>
    ),
    compactLeading: <Image systemName={icon} size={14} color={islandTint} />,
    compactTrailing: clock(15, 64),
    minimal: <Image systemName={icon} size={13} color={islandTint} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={icon} size={16} color={islandTint} />
        <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{props.title}</Text>
      </VStack>
    ),
    expandedTrailing: clock(28, 120),
    expandedBottom: (
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ size: 13 }), secondary, lineLimit(2)]}>{status}</Text>
        {progress}
        {away ? <Text modifiers={[font({ size: 12 }), secondary, lineLimit(1)]}>{props.awayHint}</Text> : null}
      </VStack>
    ),
  };
};
