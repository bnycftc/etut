import { parseWidgetTipState, widgetTipAfterFinish } from '../widget-tip';

describe('one-time widget card', () => {
  it('waits for the first Bitir that saved study time', () => {
    expect(widgetTipAfterFinish('waiting', 0)).toBe('waiting');
    expect(widgetTipAfterFinish('waiting', 1)).toBe('due');
  });

  it('a later Bitir changes nothing: due stays due, "Gösterme" is for good', () => {
    expect(widgetTipAfterFinish('due', 45 * 60_000)).toBe('due');
    expect(widgetTipAfterFinish('dismissed', 45 * 60_000)).toBe('dismissed');
  });

  it('reads an unknown or missing stored value as "not yet"', () => {
    expect(parseWidgetTipState(null)).toBe('waiting');
    expect(parseWidgetTipState('shown')).toBe('waiting');
    expect(parseWidgetTipState('due')).toBe('due');
    expect(parseWidgetTipState('dismissed')).toBe('dismissed');
  });
});
