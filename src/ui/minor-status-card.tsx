/**
 * K-23 for the student: while the minor policy limits a 15–17 group account (no parent approval
 * yet, or 15–17 closed), says what is limited, why, and how a parent approves; from day 14 it
 * leads with a gentle reminder (src/domain/minor-policy.ts). Renders nothing for everyone else,
 * and nothing while loading or when the server cannot be reached (the server enforces the limits
 * either way). Not wired into a screen here: the integration step (WP-J) places it.
 */

import { useEffect, useState } from 'react';

import { minorRestriction, type MinorStatus, showApprovalReminder } from '../domain/minor-policy';
import { tr } from '../strings';
import { type MinorApi, minorApi } from '../sync/minor-api';
import { Card, Label } from './components';

const t = tr.minor.card;

export function MinorStatusCard({ api = minorApi() }: { api?: MinorApi }) {
  const [status, setStatus] = useState<MinorStatus | null>(null);

  useEffect(() => {
    let live = true;
    api.myMinorStatus().then(
      (s) => {
        if (live) setStatus(s);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  const restriction = status === null ? null : minorRestriction(status);
  if (status === null || restriction === null) return null;
  const reminder = showApprovalReminder(status);

  return (
    <Card testID="minor-status-card" tone={reminder ? 'hero' : 'default'}>
      {reminder ? (
        <Label testID="minor-reminder" variant="heading">
          {t.reminder}
        </Label>
      ) : (
        <Label variant="heading">{t.title}</Label>
      )}
      <Label testID="minor-info">{t[restriction]}</Label>
      <Label variant="muted">{t.why}</Label>
      {restriction === 'closed' ? null : (
        <Label testID="minor-next" variant="small">
          {status.linked ? t.waiting : t.notLinked}
        </Label>
      )}
    </Card>
  );
}
