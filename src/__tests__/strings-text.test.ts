import { tr } from '../strings';

describe('share card wording', () => {
  it('daily goal line takes the suffix of how the percent is read', () => {
    expect(tr.share.goalDay(42)).toBe('Günlük hedefin %42’si');
    expect(tr.share.goalDay(10)).toBe('Günlük hedefin %10’u');
    expect(tr.share.goalDay(3)).toBe('Günlük hedefin %3’ü');
    expect(tr.share.goalDay(6)).toBe('Günlük hedefin %6’sı');
    expect(tr.share.goalDay(40)).toBe('Günlük hedefin %40’ı');
    expect(tr.share.goalDay(0)).toBe('Günlük hedefin %0’ı');
    expect(tr.share.goalDay(100)).toBe('Günlük hedef tamam');
  });

  it('the card names the week metrics like the weekly summary does', () => {
    expect(tr.share.goalWeek(3)).toBe(tr.weekly.goalDays(3));
    expect(tr.share.activeDays(5)).toBe(tr.weekly.activeDays(5));
  });
});

describe('history bar label', () => {
  it('hours are decimal ("1,1 sa"), never a clock-like "1:06"', () => {
    expect(tr.history.barValue(1, 6)).toBe('1,1 sa');
    expect(tr.history.barValue(2, 30)).toBe('2,5 sa');
    expect(tr.history.barValue(3, 0)).toBe('3 sa');
    expect(tr.history.barValue(0, 45)).toBe('45 dk');
  });
});
