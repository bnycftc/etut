/**
 * Home Screen / Lock Screen widget "Etüt: Bugün" (expo-widgets): today's study time, the daily
 * goal, the streak and the exam countdown ("YKS’ye 255 gün"; the small widget shows it in the line
 * the "Sayaç açık" note uses while the timer runs).
 *
 * Same rules as `timer-activity.tsx`: the `'widget'` function runs in the widget extension's own
 * runtime and sees only its props, its environment and @expo/ui/swift-ui. Texts arrive formatted
 * in the props. While study time grows (running timer) the widget draws the clock and the goal
 * bar itself from time ranges; otherwise it shows the static values of the timeline entry.
 * The small widget shows the goal as a ring next to the title (the bar's twin: the same ranges and
 * values), the medium one as a bar.
 */

import { Gauge, HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
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
import type { WidgetEnvironment } from 'expo-widgets';

import type { TodayWidgetProps } from '../surface-props';

export const TodayWidget = (props: TodayWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const accessory = environment.widgetFamily === 'accessoryRectangular';
  const fullColor = environment.widgetRenderingMode === undefined || environment.widgetRenderingMode === 'fullColor';
  const accent = !fullColor ? '#FFFFFF' : dark ? '#5C7CFA' : '#3B5BDB';
  const background = containerBackground(accessory ? 'transparent' : dark ? '#151B2B' : '#FFFFFF', 'widget');
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const countingFrom = props.countingFrom;

  const total = (size: number) =>
    countingFrom !== null ? (
      <Text
        timerInterval={{ lower: new Date(countingFrom), upper: new Date(countingFrom + 86400000) }}
        countsDown={false}
        modifiers={[font({ size: size, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1)]}
      />
    ) : (
      <Text modifiers={[font({ size: size, weight: 'bold', design: 'rounded' }), lineLimit(1)]}>{props.total}</Text>
    );

  const goalBar =
    props.goalLine === null ? null : props.goalFrom !== null && props.goalTo !== null ? (
      <ProgressView
        timerInterval={{ lower: new Date(props.goalFrom), upper: new Date(props.goalTo) }}
        countsDown={false}
        modifiers={[tint(accent)]}
      />
    ) : (
      <ProgressView value={props.goalRatio} modifiers={[tint(accent)]} />
    );

  const goalRing =
    props.goalLine === null ? null : props.goalFrom !== null && props.goalTo !== null ? (
      <ProgressView
        timerInterval={{ lower: new Date(props.goalFrom), upper: new Date(props.goalTo) }}
        countsDown={false}
        modifiers={[progressViewStyle('circular'), tint(accent), frame({ width: 40, height: 40 })]}
      />
    ) : (
      <Gauge value={props.goalRatio} modifiers={[gaugeStyle('circularCapacity'), tint(accent)]} />
    );

  const small = (text: string | null) =>
    text === null ? null : <Text modifiers={[font({ size: 12 }), secondary, lineLimit(1)]}>{text}</Text>;

  if (accessory) {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[background]}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), lineLimit(1)]}>{props.title}</Text>
        {total(20)}
        {small(props.streakLine !== null ? props.streakLine : props.goalLine !== null ? props.goalLine : props.countdownLine)}
      </VStack>
    );
  }

  if (environment.widgetFamily === 'systemMedium') {
    return (
      <HStack spacing={16} modifiers={[background, padding({ all: 4 })]}>
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(accent)]}>{props.title}</Text>
          {total(30)}
          {small(props.runningNote)}
          <Spacer />
        </VStack>
        <Spacer />
        <VStack alignment="leading" spacing={6}>
          {small(props.goalLine)}
          {goalBar}
          {small(props.streakLine)}
          {small(props.countdownLine)}
          <Spacer />
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={4} modifiers={[background]}>
      <HStack spacing={8}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(accent)]}>{props.title}</Text>
        <Spacer />
        {goalRing}
      </HStack>
      {total(30)}
      {small(props.runningNote !== null ? props.runningNote : props.countdownLine)}
      <Spacer />
      {small(props.goalLine)}
      {small(props.streakLine)}
    </VStack>
  );
};
