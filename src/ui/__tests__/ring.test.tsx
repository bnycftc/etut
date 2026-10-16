/**
 * The goal ring (src/ui/ring.tsx): which half-circle arcs are drawn and how far they are turned.
 * Clockwise from 12 o'clock: the right half fills first, then the left.
 */

import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';

import { useReducedMotion } from '../motion';
import { Ring, RING_FILL_MS } from '../ring';

// The ring is hidden from screen readers; the queries look at it anyway.
const HIDDEN = { includeHiddenElements: true } as const;

function rotation(testID: string): string | null {
  const node = screen.queryByTestId(testID, HIDDEN);
  if (node === null) return null;
  const transform = StyleSheet.flatten(node.props.style).transform as { rotate: string }[];
  return transform[0].rotate;
}

function draw(ratio: number) {
  render(<Ring testID="ring" ratio={ratio} color="#3B5BDB" track="#D6DCEA" />);
}

it('empty: only the track', () => {
  draw(0);
  expect(screen.getByTestId('ring', HIDDEN)).toBeTruthy();
  expect(rotation('ring-right')).toBeNull();
  expect(rotation('ring-left')).toBeNull();
});

it('a quarter: the right arc turned 90° in from its hidden place (45° + 90°)', () => {
  draw(0.25);
  expect(rotation('ring-right')).toBe('135deg');
  expect(rotation('ring-left')).toBeNull();
});

it('three quarters: the right half full, the left one half in', () => {
  draw(0.75);
  expect(rotation('ring-right')).toBe('225deg');
  expect(rotation('ring-left')).toBe('135deg');
});

it('done (and beyond): both halves full', () => {
  draw(1.4);
  expect(rotation('ring-right')).toBe('225deg');
  expect(rotation('ring-left')).toBe('225deg');
});

it('is hidden from screen readers (the goal line says it in words)', () => {
  draw(0.5);
  const ring = screen.getByTestId('ring', HIDDEN);
  expect(ring.props.accessibilityElementsHidden).toBe(true);
  expect(ring.props.importantForAccessibility).toBe('no-hide-descendants');
});

describe('filling once (the session that reached the daily goal)', () => {
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

  /** The ring's current fill, 0…1 (Animated keeps it on the value). */
  const fill = (value: unknown) => (value as { __getValue(): number }).__getValue();

  let timing: jest.SpyInstance;
  beforeEach(() => {
    timing = jest.spyOn(Animated, 'timing');
  });
  afterEach(async () => {
    timing.mockRestore();
    await systemReducesMotion(false);
  });

  it('fills from where the day stood to 100 % in 600 ms, easing out, with what sits in the middle', () => {
    render(
      <Ring testID="ring" ratio={1} fillFrom={0.4} color="#1F7A45" track="#B4C2F4">
        <Text testID="seal">✓</Text>
      </Ring>,
    );
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 1, duration: RING_FILL_MS });
    expect(RING_FILL_MS).toBe(600);
    expect(fill(timing.mock.calls[0][0])).toBeCloseTo(0.4);
    expect(screen.getByTestId('seal', HIDDEN)).toBeTruthy();
  });

  it('a ring at rest does not animate', () => {
    draw(0.6);
    expect(timing).not.toHaveBeenCalled();
  });

  it('with Reduce Motion it is simply full', async () => {
    await systemReducesMotion(true);
    render(<Ring testID="ring" ratio={1} fillFrom={0.4} color="#1F7A45" track="#B4C2F4" />);
    expect(timing).not.toHaveBeenCalled();
    expect(rotation('ring-right')).toBe('225deg');
    expect(rotation('ring-left')).toBe('225deg');
  });

  it('Reduce Motion turned on while it fills: it jumps to full', () => {
    let changed: ((value: boolean) => void) | undefined;
    jest.mocked(AccessibilityInfo.addEventListener).mockImplementationOnce((_event, handler) => {
      changed = handler as unknown as (value: boolean) => void;
      return { remove: jest.fn() } as never;
    });
    render(<Ring testID="ring" ratio={1} fillFrom={0} color="#1F7A45" track="#B4C2F4" />);
    expect(fill(timing.mock.calls[0][0])).toBe(0);
    act(() => changed?.(true));
    expect(rotation('ring-right')).toBe('225deg');
    expect(rotation('ring-left')).toBe('225deg');
  });
});
