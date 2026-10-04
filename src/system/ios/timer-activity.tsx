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
 */

import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityEnvironment } from 'expo-widgets';

import type { TimerActivityProps } from '../surface-props';

export const TimerActivity = (props: TimerActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const showNext =
    environment.isStale === true &&
    props.nextStatus !== null &&
    props.nextFrom !== null &&
    props.nextTo !== null;
  const status = showNext ? props.nextStatus : props.status;
  const icon = showNext && props.nextIcon !== null ? props.nextIcon : props.icon;
  const lower = new Date(showNext ? (props.nextFrom ?? props.from) : props.from);
  const upper = new Date(showNext ? (props.nextTo ?? props.to) : props.to);
  const pauseTime = !showNext && props.pausedAt !== null ? new Date(props.pausedAt) : undefined;
  const countsDown = showNext ? true : props.countsDown;
  const accent = environment.isLuminanceReduced === true ? '#FFFFFF' : '#4C8DFF';
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

  const progress = !props.showProgress ? null : !showNext && pauseTime !== undefined ? (
    <ProgressView value={props.progress} modifiers={[foregroundStyle(accent)]} />
  ) : (
    <ProgressView timerInterval={{ lower: lower, upper: upper }} countsDown={false} />
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={8}>
          <Image systemName={icon} size={15} color={accent} />
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>{status}</Text>
        </HStack>
        {clock(40, 0)}
        {progress}
      </VStack>
    ),
    compactLeading: <Image systemName={icon} size={14} color={accent} />,
    compactTrailing: clock(15, 64),
    minimal: <Image systemName={icon} size={13} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={icon} size={16} color={accent} />
        <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{props.title}</Text>
      </VStack>
    ),
    expandedTrailing: clock(28, 120),
    expandedBottom: (
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ size: 13 }), secondary, lineLimit(1)]}>{status}</Text>
        {progress}
      </VStack>
    ),
  };
};
