/**
 * Halka wave 2 visuals: the net chart's target band, the bar chart's tones, the month calendar's
 * today ring, the empty state's circle and the share card (study numbers only, K-09).
 */

import { render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';

import { monthView } from '../../domain/month-calendar';
import type { StudyCard } from '../../domain/share-card';
import { BarChart, EmptyState } from '../components';
import { MonthCalendar } from '../month-calendar';
import { NetChart } from '../net-chart';
import { StudyCardView, totalParts } from '../study-card';
import { subjectColor } from '../subject-colors';
import { DARK, LIGHT } from '../theme';

// Decorative parts are hidden from screen readers; the queries look at them anyway.
const HIDDEN = { includeHiddenElements: true } as const;

const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, HIDDEN).props.style);

describe('net chart', () => {
  it('draws the target as a soft band labelled "Hedef 30" and says it to screen readers', () => {
    render(
      <NetChart testID="chart" questions={40} target={30} points={[{ key: 'a', label: '1 Eki', value: 20 }]} />,
    );
    expect(style('chart-target-band').backgroundColor).toBe(LIGHT.accentSoft);
    expect(screen.getByTestId('chart-target', HIDDEN).props.children).toBe('Hedef 30');
    expect(screen.getByTestId('chart').props.accessibilityLabel).toContain('hedef 30 net');
    expect(screen.queryByText('Kesik çizgi: hedef net.')).toBeNull();
  });

  /** Where the value is written: above or below the centre of its point. */
  const side = (target: number | null, value: number) => {
    const { unmount } = render(
      <NetChart testID="chart" questions={40} target={target} points={[{ key: 'a', label: '1 Eki', value }]} />,
    );
    const point = style('chart-point-0');
    const centre = (point.top as number) + (point.height as number) / 2;
    const label = style('chart-value-0').top as number;
    unmount();
    return label > centre ? 'below' : 'above';
  };

  it('a value whose label would sit on the target band is written under its point', () => {
    // 27 just under a target of 30: written above, "27" would lie on the band.
    expect(side(30, 27)).toBe('below');
    expect(side(null, 27)).toBe('above');
  });

  it('a value clear of the band stays above its point', () => {
    expect(side(30, 5)).toBe('above');
    expect(side(30, 30)).toBe('above');
  });

  it('a last net just above the target: the "Hedef" label moves off its point, the value stays off the band', () => {
    render(
      <NetChart
        testID="chart"
        questions={100}
        target={80}
        points={[
          { key: 'a', label: '1 Eki', value: 60 },
          { key: 'b', label: '8 Eki', value: 85 },
        ]}
      />,
    );
    const box = (id: string, width: number, height: number) => {
      const s = style(id);
      return { left: s.left as number, top: s.top as number, width: (s.width as number) ?? width, height };
    };
    const meets = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
      a.top < b.top + b.height && a.top + a.height > b.top && a.left < b.left + b.width && a.left + a.width > b.left;
    const point = box('chart-point-1', 18, 18);
    const label = box('chart-target', 72, 16);
    const value = box('chart-value-1', 60, 16);
    const band = box('chart-target-band', 0, 10);
    expect(meets(label, point)).toBe(false);
    expect(meets(value, band)).toBe(false);
    expect(meets(value, label)).toBe(false);
  });

  it('has no band without a target', () => {
    render(<NetChart testID="chart" questions={40} points={[{ key: 'a', label: '1 Eki', value: 20 }]} />);
    expect(screen.queryByTestId('chart-target-band', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('chart-target', HIDDEN)).toBeNull();
  });
});

/** Fill colours of the bars, left to right (the 70 % wide Views). */
function barColours(): string[] {
  return screen
    .UNSAFE_getAllByType(View)
    .map((v) => StyleSheet.flatten(v.props.style))
    .filter((s) => s?.width === '70%')
    .map((s) => s.backgroundColor as string);
}

describe('bar chart', () => {
  const bar = (key: string, value: number, highlight = false) => ({
    key,
    label: key,
    value,
    valueLabel: String(value),
    highlight,
  });

  it('today is the brand blue, the other days soft, an empty day muted', () => {
    render(<BarChart bars={[bar('a', 2), bar('b', 0), bar('c', 3, true)]} />);
    expect(barColours()).toEqual([LIGHT.barSoft, LIGHT.barMuted, LIGHT.accent]);
  });

  it('without a highlighted bar every bar keeps the full bar colour', () => {
    render(<BarChart bars={[bar('a', 2), bar('b', 3)]} />);
    expect(barColours()).toEqual([LIGHT.bar, LIGHT.bar]);
  });
});

describe('month calendar', () => {
  it('rings today in the brand blue; other days keep a transparent ring of the same size', () => {
    render(<MonthCalendar view={monthView([], '2026-10-01', '2026-10-07')} today="2026-10-07" />);
    const today = style('monthly-day-2026-10-07');
    const other = style('monthly-day-2026-10-06');
    expect(today.borderColor).toBe(LIGHT.accent);
    expect(today.borderWidth).toBe(2);
    expect(today.padding).toBe(2);
    expect(today.borderRadius).toBe(8);
    expect(other.borderColor).toBe('transparent');
    expect(other.borderWidth).toBe(2);
  });
});

describe('empty state', () => {
  it('shows its symbol in a 72 pt soft brand circle, the title as a header and a tonal action', () => {
    render(<EmptyState testID="empty" icon="history" title="Henüz yok" body="Burada görünür." action="Git" onAction={() => {}} />);
    const circle = style('empty-icon');
    expect(circle.width).toBe(72);
    expect(circle.borderRadius).toBe(36);
    expect(circle.backgroundColor).toBe(LIGHT.accentSoft);
    expect(screen.getByRole('header', { name: 'Henüz yok' })).toBeTruthy();
    expect(style('empty-action').backgroundColor).toBe(LIGHT.secondaryFill);
  });

  it('without a symbol there is no circle', () => {
    render(<EmptyState testID="empty" body="Burada görünür." />);
    expect(screen.queryByTestId('empty-icon', HIDDEN)).toBeNull();
  });
});

describe('share card', () => {
  const card = (over: Partial<StudyCard> = {}): StudyCard => ({
    period: 'day',
    from: '2026-10-07',
    to: '2026-10-07',
    totalMs: 150 * 60_000,
    rows: [
      { subjectId: 'matematik', ms: 90 * 60_000, percent: 60 },
      { subjectId: null, ms: 60 * 60_000, percent: 40 },
    ],
    activeDays: null,
    goalMinutes: 120,
    goalPercent: 100,
    goalDays: null,
    streakDays: 3,
    ...over,
  });

  it.each([
    ['light', LIGHT],
    ['dark', DARK],
  ] as const)('%s: the soft brand tint, each subject in its colour, the goal ring in the corner', (scheme, p) => {
    const { toJSON } = render(<StudyCardView card={card()} scheme={scheme} width={360} />);
    const root = toJSON();
    expect(root !== null && !Array.isArray(root) ? StyleSheet.flatten(root.props.style) : null).toMatchObject({
      backgroundColor: p.accentSoft,
    });
    expect(style('share-card-bar-matematik').backgroundColor).toBe(subjectColor('matematik', p));
    expect(style('share-card-bar-rest').backgroundColor).toBe(p.textMuted);
    expect(screen.getByTestId('share-card-goal-ring', HIDDEN)).toBeTruthy();
  });

  it('has no ring without a goal, and only study numbers on it (K-09)', () => {
    render(
      <StudyCardView card={card({ goalMinutes: null, goalPercent: null, streakDays: null })} scheme="light" width={360} />,
    );
    expect(screen.queryByTestId('share-card-goal-ring', HIDDEN)).toBeNull();
    // Nothing that identifies or links: no address, handle or code on the image.
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(/https?:|www\.|@|\.com/);
  });

  it('the total is the hero: its numbers 56 pt, its units smaller, on one line', () => {
    render(<StudyCardView card={card()} scheme="light" width={360} />);
    const total = screen.getByText('2 sa 30 dk');
    expect(StyleSheet.flatten(total.props.style)).toMatchObject({ fontSize: 56, fontWeight: '800', color: LIGHT.accent });
    expect(total.props.numberOfLines).toBe(1);
  });
});

describe('share card total', () => {
  it('splits numbers from units and keeps a long week at full size', () => {
    expect(totalParts('2 sa 30 dk')).toEqual({
      parts: [
        { text: '2', number: true },
        { text: ' sa ', number: false },
        { text: '30', number: true },
        { text: ' dk', number: false },
      ],
      scale: 1,
    });
    expect(totalParts('45 sa 30 dk').scale).toBe(1);
  });

  it('scales down only a total that would not fit', () => {
    expect(totalParts('12345 sa 59 dk').scale).toBeLessThan(1);
  });
});
