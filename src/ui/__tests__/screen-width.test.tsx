/**
 * iPad: a screen's content is a centred column at most CONTENT_MAX_WIDTH wide (the background fills
 * the window), the ScreenTop slot sits above a screen's own content, and the net chart is as wide
 * as its card (measured on layout), not as the window.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { CONTENT_MAX_WIDTH, Screen } from '../components';
import { NetChart } from '../net-chart';
import { ScreenTop, ScreenTopProvider } from '../screen-top';

it('Screen: content is a centred column at most 720 pt wide, the background is not', () => {
  render(
    <Screen testID="s">
      <Text>İçerik</Text>
    </Screen>,
  );
  const scroll = screen.getByTestId('s');
  expect(CONTENT_MAX_WIDTH).toBe(720);
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  });
  const outer = StyleSheet.flatten(scroll.props.style);
  expect(outer.maxWidth).toBeUndefined();
  expect(outer.flex).toBe(1);
});

it('ScreenTop: renders nothing without a provider or with null', () => {
  render(
    <Screen testID="s">
      <Text>İçerik</Text>
    </Screen>,
  );
  expect(screen.queryByTestId('band')).toBeNull();
  render(
    <ScreenTopProvider value={null}>
      <ScreenTop />
    </ScreenTopProvider>,
  );
  expect(screen.toJSON()).toBeNull();
});

it('ScreenTop: the provider’s node is shown in every Screen, above its content', () => {
  render(
    <ScreenTopProvider value={<Text testID="band">Örnek veri</Text>}>
      <Screen testID="s">
        <Text testID="first">İçerik</Text>
      </Screen>
    </ScreenTopProvider>,
  );
  expect(screen.getByTestId('band')).toBeTruthy();
  const texts = screen.getAllByText(/Örnek veri|İçerik/).map((node) => node.props.children);
  expect(texts).toEqual(['Örnek veri', 'İçerik']);
});

it('NetChart: points follow the measured width, not the window', () => {
  const points = [
    { key: 'a', label: '1 Eki', value: 10 },
    { key: 'b', label: '8 Eki', value: 20 },
  ];
  render(<NetChart testID="chart" questions={40} points={points} />);
  const lastLeft = () => StyleSheet.flatten(screen.getByTestId('chart-point-1').props.style).left as number;
  const chart = screen.getByTestId('chart');

  fireEvent(chart, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 600, height: 182 } } });
  const wide = lastLeft();
  fireEvent(chart, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 182 } } });
  const narrow = lastLeft();

  // The last point sits SIDE (14) from the right edge, centred: width − 14 − POINT/2 (9).
  expect(wide).toBe(600 - 14 - 9);
  expect(narrow).toBe(300 - 14 - 9);
});
