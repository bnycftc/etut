/**
 * Home Screen / Lock Screen widget "Etüt: Sınav" (expo-widgets): days left to the exam
 * ("YKS’ye · 255 gün"). Small on the Home Screen, circular and inline on the Lock Screen.
 *
 * Same rules as `today-widget.tsx`: the `'widget'` function runs in the widget extension's own
 * runtime and sees only its props, its environment and @expo/ui/swift-ui. Texts arrive formatted in
 * the props (`countdownWidgetProps`); the timeline has an entry for every Istanbul midnight, so the
 * widget never computes a date. Stored props have no `null` fields (home-widget.ios.ts) and the
 * placeholder has no props at all: a missing text counts as `null`, and without props the widget
 * reads like "no exam date" (the same texts as `emptyCountdownProps()`).
 */

import { Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';

import type { CountdownWidgetProps } from '../surface-props';

export const CountdownWidget = (props: CountdownWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const family = environment.widgetFamily;
  const accessory = family === 'accessoryCircular' || family === 'accessoryInline';
  const fullColor = environment.widgetRenderingMode === undefined || environment.widgetRenderingMode === 'fullColor';
  const accent = !fullColor ? '#FFFFFF' : dark ? '#5C7CFA' : '#3B5BDB';
  const background = containerBackground(accessory ? 'transparent' : dark ? '#151B2B' : '#FFFFFF', 'widget');
  const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });
  const line = (value: string | null | undefined) => (typeof value === 'string' ? value : null);
  const count = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const title = line(props.title) ?? 'Sınav';
  const daysLeft = count(props.daysLeft);
  const daysText = line(props.daysText);
  const message = line(props.message) ?? (daysText === null ? 'Sınav tarihi ekle' : null);
  const inline = line(props.inline) ?? message ?? title;

  if (family === 'accessoryInline') {
    return <Text modifiers={[lineLimit(1)]}>{inline}</Text>;
  }

  if (family === 'accessoryCircular') {
    return daysLeft !== null && daysLeft > 0 ? (
      <VStack spacing={0} modifiers={[background]}>
        <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1)]}>
          {String(daysLeft)}
        </Text>
        {/* The unit only: the number above it comes from the props (strings.widget.countdown). */}
        <Text modifiers={[font({ size: 10 }), lineLimit(1)]}>gün</Text>
      </VStack>
    ) : (
      <VStack spacing={0} modifiers={[background]}>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), lineLimit(3)]}>{message ?? title}</Text>
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={4} modifiers={[background]}>
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(accent), lineLimit(1)]}>{title}</Text>
      <Spacer />
      {daysText !== null ? (
        <Text modifiers={[font({ size: 34, weight: 'bold', design: 'rounded' }), monospacedDigit(), lineLimit(1)]}>
          {daysText}
        </Text>
      ) : null}
      {message !== null ? (
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), secondary, lineLimit(3)]}>{message}</Text>
      ) : null}
    </VStack>
  );
};
