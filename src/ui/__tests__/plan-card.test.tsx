import { fireEvent, render, screen } from '@testing-library/react-native';

import type { TodayPlanBlock } from '../../storage/study-plan';
import { PlanCard } from '../plan-card';

// The card itself reads nothing: only the hook next to it does.
jest.mock('../../storage/study-plan', () => ({ todaysPlan: jest.fn(), studiedThisWeek: jest.fn() }));

const BLOCKS: TodayPlanBlock[] = [
  { day: 1, subjectId: 'fizik', topicId: 'tyt.fizik.basinc', minutes: 45, reason: 'next', done: true },
  { day: 1, subjectId: 'matematik', topicId: null, minutes: 30, reason: 'target', done: false },
  { day: 1, subjectId: 'turkce', topicId: 'tyt.turkce.paragrafta-anlam', minutes: 60, reason: 'missed', done: false },
];

it('shows every block with subject, minutes, topic and reason; done blocks are ticked', () => {
  render(<PlanCard blocks={BLOCKS} onStart={() => {}} />);
  expect(screen.getByTestId('plan-card')).toBeTruthy();
  expect(screen.getByText('Bugünün planı')).toBeTruthy();
  expect(screen.getByTestId('plan-progress').props.children).toBe('1/3 tamam');
  expect(screen.getByText('Fizik · 45 dk')).toBeTruthy();
  expect(screen.getByText('Basınç · sıradaki konu')).toBeTruthy();
  expect(screen.getByText('Matematik · 30 dk')).toBeTruthy();
  // A subject-only block shows just its reason.
  expect(screen.getByText('haftalık ders hedefin')).toBeTruthy();
  expect(screen.getByText('Türkçe · 60 dk')).toBeTruthy();
  expect(screen.getByText('Paragrafta Anlam · denemelerde kaçırdığın konu')).toBeTruthy();
  expect(screen.getByTestId('plan-block-done-0')).toBeTruthy();
  expect(screen.queryByTestId('plan-block-done-1')).toBeNull();
  expect(screen.getAllByTestId(/^plan-block-\d$/)).toHaveLength(3);
});

it('Başlat starts the timer on the block’s subject and topic', () => {
  const onStart = jest.fn();
  render(<PlanCard blocks={BLOCKS} onStart={onStart} />);
  fireEvent.press(screen.getByTestId('plan-block-start-0'));
  expect(onStart).toHaveBeenLastCalledWith('fizik', 'tyt.fizik.basinc');
  fireEvent.press(screen.getByTestId('plan-block-start-1'));
  expect(onStart).toHaveBeenLastCalledWith('matematik', null);
  expect(onStart).toHaveBeenCalledTimes(2);
  // The button names what it starts.
  expect(screen.getByRole('button', { name: 'Fizik, Basınç, 45 dakika: sayacı başlat' })).toBeTruthy();
});

it('a rest day is never an empty card', () => {
  render(<PlanCard blocks={[]} onStart={() => {}} />);
  expect(screen.getByTestId('plan-card')).toBeTruthy();
  expect(screen.getByTestId('plan-rest').props.children).toMatch(/^Bugün dinlenme günü/);
  expect(screen.queryByTestId('plan-progress')).toBeNull();
  expect(screen.queryByTestId('plan-block-start-0')).toBeNull();
});
