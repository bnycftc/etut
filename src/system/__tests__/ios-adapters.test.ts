/**
 * The iOS adapters for the Live Activity and the Home Screen widget against a stand-in for
 * expo-widgets: what reaches ActivityKit / WidgetKit, and that every failure is swallowed (the
 * app keeps working without the surface).
 *
 * The layouts themselves (`ios/timer-activity.tsx`, `ios/today-widget.tsx`) are replaced here:
 * babel-preset-expo's widgets plugin turns their `'widget'` functions into source strings for
 * the extension's own runtime, so Jest cannot run them. They are checked on a device (E2E
 * screenshots, `m-canli-sayac`) and through their props (`surface-props.test.ts`).
 */

import type { TimerActivityProps, TodayWidgetProps } from '../surface-props';
import type { HomeWidgetAdapter, LiveActivityAdapter } from '../types';

jest.mock('../ios/timer-activity', () => ({ TimerActivity: 'timer-activity-layout' }));
jest.mock('../ios/today-widget', () => ({ TodayWidget: 'today-widget-layout' }));

interface MockInstance {
  updates: { props: unknown; staleDate: Date | undefined }[];
  ended: string[];
  fail: boolean;
  update(props: unknown, staleDate?: Date): Promise<void>;
  end(how: string): Promise<void>;
}

const mockKit: {
  failCreate: boolean;
  failStart: boolean;
  failInstances: boolean;
  failTimeline: boolean;
  created: { name: string; layout: unknown }[];
  started: { props: unknown; url: unknown; staleDate: Date | undefined }[];
  instances: MockInstance[];
  timelines: { date: Date; props: unknown }[][];
} = {
  failCreate: false,
  failStart: false,
  failInstances: false,
  failTimeline: false,
  created: [],
  started: [],
  instances: [],
  timelines: [],
};

function mockInstance(fail = false): MockInstance {
  return {
    updates: [],
    ended: [],
    fail,
    async update(props, staleDate) {
      if (this.fail) throw new Error('ended meanwhile');
      this.updates.push({ props, staleDate });
    },
    async end(how) {
      if (this.fail) throw new Error('already gone');
      this.ended.push(how);
    },
  };
}

jest.mock('expo-widgets', () => ({
  createLiveActivity: (name: string, layout: unknown) => {
    if (mockKit.failCreate) throw new Error('no ActivityKit');
    mockKit.created.push({ name, layout });
    return {
      getInstances: () => {
        if (mockKit.failInstances) throw new Error('not available');
        return mockKit.instances;
      },
      start: (props: unknown, url: unknown, staleDate: Date | undefined) => {
        if (mockKit.failStart) throw new Error('Live Activities are turned off');
        mockKit.started.push({ props, url, staleDate });
        mockKit.instances.push(mockInstance());
      },
    };
  },
  createWidget: (name: string, layout: unknown) => {
    if (mockKit.failCreate) throw new Error('no WidgetKit');
    mockKit.created.push({ name, layout });
    return {
      updateTimeline: (entries: { date: Date; props: unknown }[]) => {
        if (mockKit.failTimeline) throw new Error('no App Group container');
        mockKit.timelines.push(entries);
      },
    };
  },
}));

const loadLive = (): LiveActivityAdapter => {
  let adapter: LiveActivityAdapter | undefined;
  jest.isolateModules(() => {
    adapter = (require('../live-activity.ios') as { liveActivity: LiveActivityAdapter }).liveActivity;
  });
  return adapter!;
};
const loadWidget = (): HomeWidgetAdapter => {
  let adapter: HomeWidgetAdapter | undefined;
  jest.isolateModules(() => {
    adapter = (require('../home-widget.ios') as { homeWidget: HomeWidgetAdapter }).homeWidget;
  });
  return adapter!;
};

const PROPS = { title: 'Fizik', status: 'Çalışıyorsun' } as unknown as TimerActivityProps;
const WIDGET = { title: 'Bugün', total: '30 dk' } as unknown as TodayWidgetProps;
const T = Date.parse('2026-10-07T09:00:00Z');

beforeEach(() => {
  mockKit.failCreate = false;
  mockKit.failStart = false;
  mockKit.failInstances = false;
  mockKit.failTimeline = false;
  mockKit.created = [];
  mockKit.started = [];
  mockKit.instances = [];
  mockKit.timelines = [];
});

describe('Live Activity (live-activity.ios.ts)', () => {
  it('registers the layout under the name running activities use', () => {
    const live = loadLive();
    expect(live.supported).toBe(true);
    expect(mockKit.created).toEqual([{ name: 'EtutTimer', layout: 'timer-activity-layout' }]);
  });

  it('start passes the props and the stale date, without a push URL', () => {
    const live = loadLive();
    expect(live.count()).toBe(0);
    expect(live.start(PROPS, T)).toBe(true);
    expect(live.start(PROPS, null)).toBe(true);
    expect(mockKit.started).toEqual([
      { props: PROPS, url: undefined, staleDate: new Date(T) },
      { props: PROPS, url: undefined, staleDate: undefined },
    ]);
    expect(live.count()).toBe(2);
  });

  it('a refused start (turned off in Settings, app in the background) is false', () => {
    const live = loadLive();
    mockKit.failStart = true;
    expect(live.start(PROPS, T)).toBe(false);
  });

  it('update reaches every instance; one that ended meanwhile does not stop the others', async () => {
    const live = loadLive();
    mockKit.instances = [mockInstance(true), mockInstance()];
    await expect(live.update(PROPS, T)).resolves.toBeUndefined();
    expect(mockKit.instances[1].updates).toEqual([{ props: PROPS, staleDate: new Date(T) }]);
  });

  it('endAll ends each one at once; an instance already gone is skipped', async () => {
    const live = loadLive();
    mockKit.instances = [mockInstance(), mockInstance(true), mockInstance()];
    await live.endAll();
    expect(mockKit.instances.map((i) => i.ended)).toEqual([['immediate'], [], ['immediate']]);
  });

  it('instances that cannot be read count as none', async () => {
    const live = loadLive();
    mockKit.instances = [mockInstance()];
    mockKit.failInstances = true;
    expect(live.count()).toBe(0);
    await live.update(PROPS, null);
    await live.endAll();
    expect(mockKit.instances[0].updates).toEqual([]);
  });

  it('without ActivityKit (old iOS): unsupported, every call a no-op', async () => {
    mockKit.failCreate = true;
    const live = loadLive();
    expect(live.supported).toBe(false);
    expect(live.count()).toBe(0);
    expect(live.start(PROPS, T)).toBe(false);
    await live.update(PROPS, T);
    await live.endAll();
    expect(mockKit.started).toEqual([]);
  });
});

describe('Home Screen widget (home-widget.ios.ts)', () => {
  it('registers "EtutToday" and writes the timeline with dates', () => {
    const widget = loadWidget();
    expect(widget.supported).toBe(true);
    expect(mockKit.created).toEqual([{ name: 'EtutToday', layout: 'today-widget-layout' }]);
    widget.setTimeline([
      { at: T, props: WIDGET },
      { at: T + 3_600_000, props: WIDGET },
    ]);
    expect(mockKit.timelines).toEqual([
      [
        { date: new Date(T), props: WIDGET },
        { date: new Date(T + 3_600_000), props: WIDGET },
      ],
    ]);
  });

  it('an empty timeline is not written (the widget keeps its content)', () => {
    loadWidget().setTimeline([]);
    expect(mockKit.timelines).toEqual([]);
  });

  it('no App Group container (unsigned build): swallowed', () => {
    const widget = loadWidget();
    mockKit.failTimeline = true;
    expect(() => widget.setTimeline([{ at: T, props: WIDGET }])).not.toThrow();
  });

  it('without WidgetKit: unsupported, nothing written', () => {
    mockKit.failCreate = true;
    const widget = loadWidget();
    expect(widget.supported).toBe(false);
    widget.setTimeline([{ at: T, props: WIDGET }]);
    expect(mockKit.timelines).toEqual([]);
  });
});

describe('Android and web defaults', () => {
  it('no Live Activity and no widget', async () => {
    const { liveActivity } = jest.requireActual('../live-activity.ts') as { liveActivity: LiveActivityAdapter };
    const { homeWidget } = jest.requireActual('../home-widget.ts') as { homeWidget: HomeWidgetAdapter };
    expect(liveActivity.supported).toBe(false);
    expect(liveActivity.count()).toBe(0);
    expect(liveActivity.start(PROPS, null)).toBe(false);
    await liveActivity.update(PROPS, null);
    await liveActivity.endAll();
    expect(homeWidget.supported).toBe(false);
    homeWidget.setTimeline([{ at: T, props: WIDGET }]);
    expect(mockKit.timelines).toEqual([]);
  });
});
