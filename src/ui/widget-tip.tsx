import { useState } from 'react';

import { widgetTipAfterFinish } from '../domain/widget-tip';
import { useAppState, useStored } from '../state/app-state';
import { loadWidgetTip, storeWidgetTip } from '../storage/kv';
import { tr } from '../strings';
import { homeWidget } from '../system/home-widget';
import { Button, Card, Label, ResponsiveRow } from './components';

/** After Bitir: the first session that saved study time makes the widget card due (iOS only). */
export function noteFinishForWidgetTip(savedMs: number): void {
  if (!homeWidget.supported) return;
  const state = loadWidgetTip();
  const next = widgetTipAfterFinish(state, savedMs);
  if (next !== state) storeWidgetTip(next);
}

/**
 * One-time card on the timer screen: the three steps to add the Home Screen widget (rule:
 * domain/widget-tip.ts). Only where the widget exists; "Gösterme" hides it for good.
 * `finishedAt` (the last Bitir) re-reads the stored state, so the card appears right after it.
 */
export function WidgetTip({ finishedAt }: { finishedAt: number | null }) {
  if (!homeWidget.supported) return null;
  return <WidgetTipCard finishedAt={finishedAt} />;
}

function WidgetTipCard({ finishedAt }: { finishedAt: number | null }) {
  const { dataVersions } = useAppState();
  const [closed, setClosed] = useState(0);
  const state = useStored(`widgetTip|${finishedAt}|${dataVersions.settings}|${closed}`, loadWidgetTip);
  if (state !== 'due') return null;
  return (
    <Card testID="widget-tip">
      <Label variant="heading">{tr.widgetTip.title}</Label>
      <Label variant="muted">{tr.widgetTip.body}</Label>
      {tr.guide.lockScreen.widgetSteps.map((step) => (
        <Label key={step}>{step}</Label>
      ))}
      <ResponsiveRow>
        <Button
          compact
          testID="widget-tip-dismiss"
          kind="secondary"
          title={tr.widgetTip.dismiss}
          accessibilityHint={tr.widgetTip.dismissHint}
          onPress={() => {
            storeWidgetTip('dismissed');
            setClosed((n) => n + 1);
          }}
        />
      </ResponsiveRow>
    </Card>
  );
}
