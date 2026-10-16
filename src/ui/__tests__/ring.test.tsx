/**
 * The goal ring (src/ui/ring.tsx): which half-circle arcs are drawn and how far they are turned.
 * Clockwise from 12 o'clock: the right half fills first, then the left.
 */

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Ring } from '../ring';

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
