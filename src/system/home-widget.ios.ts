/**
 * iOS Home Screen / Lock Screen widget "EtutToday" (expo-widgets). The app writes the timeline to
 * the shared App Group (`group.com.bnycftc.etut`); the widget extension only reads it.
 * The name must match `widgets[].name` in app.json.
 */

import { createWidget } from 'expo-widgets';

import { TodayWidget } from './ios/today-widget';
import type { TodayWidgetProps } from './surface-props';
import type { HomeWidgetAdapter } from './types';

function createTodayWidget() {
  try {
    return createWidget<TodayWidgetProps>('EtutToday', TodayWidget);
  } catch {
    return null;
  }
}

const widget = createTodayWidget();

/**
 * The timeline is stored in the App Group's UserDefaults, a property list: a `null` arrives there
 * as NSNull, and UserDefaults then refuses the whole timeline ("Attempt to set a non-property-list
 * object"), so the widget never gets one. `null` fields are left out; the layout reads a missing
 * field as `null`.
 */
function storable(props: TodayWidgetProps): TodayWidgetProps {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== null)) as TodayWidgetProps;
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
};
