import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { SAVED_BOUNCE_MS, SavedMark } from '../finish-moment';
import { useReducedMotion } from '../motion';

/** Lets the system answer "Reduce Motion?" the way a view mounted at launch (the root layout) hears it. */
async function systemReducesMotion(value: boolean) {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(value);
  function Probe() {
    return <Text testID="probe">{String(useReducedMotion())}</Text>;
  }
  const probe = render(<Probe />);
  await act(async () => {});
  expect(screen.getByTestId('probe').props.children).toBe(String(value));
  probe.unmount();
}

const tick = () => screen.UNSAFE_getByProps({ name: 'checkmark.circle.fill' });
const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 28, height: 28 } } };

afterEach(async () => {
  jest.useRealTimers();
  await systemReducesMotion(false);
});

it('the tick bounces once it is laid out, not before', () => {
  render(<SavedMark />);
  expect(tick().props.animationSpec).toBeUndefined();
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toEqual({ effect: { type: 'bounce' } });
});

it('the bounce is switched off once it has played, so a later change never plays it again', () => {
  jest.useFakeTimers();
  render(<SavedMark />);
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toEqual({ effect: { type: 'bounce' } });
  act(() => jest.advanceTimersByTime(SAVED_BOUNCE_MS));
  expect(tick().props.animationSpec).toBeUndefined();
  // Laid out again (rotation, text size): still no second bounce.
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toBeUndefined();
});

it('with Reduce Motion the tick does not bounce', async () => {
  await systemReducesMotion(true);
  render(<SavedMark />);
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toBeUndefined();
});
