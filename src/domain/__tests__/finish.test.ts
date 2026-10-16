import { canUndoFinish, goalStep, topicMarkToRestore, UNDO_FINISH_MS } from '../finish';

describe('undo window after Bitir', () => {
  it('is open right after finishing and closes after UNDO_FINISH_MS', () => {
    expect(canUndoFinish(1_000, 1_000)).toBe(true);
    expect(canUndoFinish(1_000, 1_000 + UNDO_FINISH_MS)).toBe(true);
    expect(canUndoFinish(1_000, 1_001 + UNDO_FINISH_MS)).toBe(false);
  });

  it('a clock that went backwards never opens it', () => {
    expect(canUndoFinish(10_000, 9_999)).toBe(false);
  });

  it('stays below the 10 s background tolerance', () => {
    expect(UNDO_FINISH_MS).toBeLessThan(10_000);
  });
});

describe('goal step of a finished session', () => {
  const MIN = 60_000;

  it('shows the percent before and after', () => {
    expect(goalStep(90 * MIN, 30 * MIN, 120)).toEqual({ beforePercent: 50, afterPercent: 75, reached: false });
  });

  it('reached only when this session crossed the goal', () => {
    expect(goalStep(130 * MIN, 30 * MIN, 120)).toEqual({ beforePercent: 83, afterPercent: 100, reached: true });
    expect(goalStep(200 * MIN, 30 * MIN, 120).reached).toBe(false);
  });

  it('never goes below zero (session longer than today, e.g. across midnight)', () => {
    expect(goalStep(20 * MIN, 50 * MIN, 60)).toEqual({ beforePercent: 0, afterPercent: 33, reached: false });
  });
});

describe('topic mark set in the summary, then "Geri al"', () => {
  it('puts back the earlier mark with its own time', () => {
    expect(topicMarkToRestore({ status: 'review', updatedAt: 7 }, 9_000)).toEqual({ status: 'review', at: 7 });
  });

  it('clears a mark the topic did not have before', () => {
    expect(topicMarkToRestore(null, 9_000)).toEqual({ status: null, at: 9_000 });
  });
});
