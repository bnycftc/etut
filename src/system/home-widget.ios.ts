/**
 * iOS Home Screen / Lock Screen widgets (expo-widgets): "EtutToday" and the exam countdown
 * "EtutCountdown". The app writes the timelines to the shared App Group (`group.com.bnycftc.etut`);
 * the widget extension only reads them. The names must match `widgets[].name` in app.json.
 */

import { createWidget } from 'expo-widgets';

import { CountdownWidget } from './ios/countdown-widget';
import { TodayWidget } from './ios/today-widget';
import type { CountdownWidgetProps, TodayWidgetProps } from './surface-props';
import type { HomeWidgetAdapter } from './types';

function createTodayWidget() {
  try {
    return createWidget<TodayWidgetProps>('EtutToday', TodayWidget);
  } catch {
    return null;
  }
}

function createCountdownWidget() {
  try {
    return createWidget<CountdownWidgetProps>('EtutCountdown', CountdownWidget);
  } catch {
    return null;
  }
}

const widget = createTodayWidget();
const countdown = createCountdownWidget();

/**
 * The timeline is stored in the App Group's UserDefaults, a property list: a `null` arrives there
 * as NSNull, and UserDefaults then refuses the whole timeline ("Attempt to set a non-property-list
 * object"), so the widget never gets one. `null` fields are left out; the layout reads a missing
 * field as `null`.
 */
function storable<T extends object>(props: T): T {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== null)) as T;
}

export const homeWidget: HomeWidgetAdapter = {
  supported: widget !== null,
  setTimeline(entries) {
    if (widget === null || entries.length === 0) return;
    try {
      widget.updateTimeline(entries.map((e) => ({ date: new Date(e.at), props: storable(e.props) })));
    } catch {
      // No App Group container (unsigned build): the widget keeps its last content.
    }
  },
  setCountdownTimeline(entries) {
    if (countdown === null || entries.length === 0) return;
    try {
      countdown.updateTimeline(entries.map((e) => ({ date: new Date(e.at), props: storable(e.props) })));
    } catch {
      // As above.
    }
  },
};
