/**
 * The one-time "Ana ekrana widget ekle" card on the timer screen (iOS: the widget exists only
 * there). The widget is the one place the student sees the day without opening the app, but the
 * steps to add it were only in "Nasıl çalışır".
 *
 * - It waits for the first "Bitir" that saved study time: before that the widget has nothing to show.
 * - Then it stays on the timer screen (while no session runs) until "Gösterme" and never returns.
 * In the app only: no notification, no badge, no second reminder (hukuk/03: no pressure).
 */

export type WidgetTipState = 'waiting' | 'due' | 'dismissed';

/** A stored value; anything unknown (or nothing) is "not yet". */
export function parseWidgetTipState(value: unknown): WidgetTipState {
  return value === 'due' || value === 'dismissed' ? value : 'waiting';
}

/** After Bitir: the first session that saved study time makes the card due; nothing else moves it. */
export function widgetTipAfterFinish(state: WidgetTipState, savedMs: number): WidgetTipState {
  return state === 'waiting' && savedMs > 0 ? 'due' : state;
}
