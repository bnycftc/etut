import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import { GOAL_FILL_MS, GoalDone, SavedMark } from '../finish-moment';
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
/** The ring's current fill, 0…1 (Animated keeps it on the value). */
const fill = (value: unknown) => (value as { __getValue(): number }).__getValue();
const layout = { nativeEvent: { layout: { x: 0, y: 0, width: 28, height: 28 } } };

let timing: jest.SpyInstance;
beforeEach(() => {
  timing = jest.spyOn(Animated, 'timing');
});
afterEach(async () => {
  timing.mockRestore();
  await systemReducesMotion(false);
});

it('the goal ring fills from where the day stood to 100 % in 600 ms, with the seal and the sentence', () => {
  render(<GoalDone testID="goal" fromRatio={0.4} />);
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: GOAL_FILL_MS });
  expect(GOAL_FILL_MS).toBe(600);
  expect(fill(timing.mock.calls[0][0])).toBeCloseTo(0.4);
  expect(screen.getByTestId('goal').props.children).toBe('Bugünkü hedef tamam');
  expect(screen.UNSAFE_getByProps({ name: 'checkmark.seal.fill' }).props.animationSpec).toBeUndefined();
});

it('with Reduce Motion the ring is simply full and the tick does not bounce', async () => {
  await systemReducesMotion(true);
  render(
    <>
      <SavedMark />
      <GoalDone fromRatio={0.4} />
    </>,
  );
  expect(timing).not.toHaveBeenCalled();
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toBeUndefined();
});

it('the tick bounces once it is laid out, not before', () => {
  render(<SavedMark />);
  expect(tick().props.animationSpec).toBeUndefined();
  fireEvent(tick(), 'layout', layout);
  expect(tick().props.animationSpec).toEqual({ effect: { type: 'bounce' } });
});

it('Reduce Motion turned on while the ring fills: it jumps to full', async () => {
  let changed: ((value: boolean) => void) | undefined;
  jest.mocked(AccessibilityInfo.addEventListener).mockImplementationOnce((_event, handler) => {
    changed = handler as unknown as (value: boolean) => void;
    return { remove: jest.fn() } as never;
  });
  render(<GoalDone fromRatio={0} />);
  expect(fill(timing.mock.calls[0][0])).toBe(0);
  act(() => changed?.(true));
  expect(fill(timing.mock.calls[0][0])).toBe(1);
});
