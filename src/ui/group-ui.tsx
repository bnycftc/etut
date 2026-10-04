/** Small pieces shared by the group screens (only rendered while GROUPS_ENABLED). */

import { ApiError } from '../sync/api';
import { tr } from '../strings';
import { Button, Label, Row } from './components';
import { usePalette } from './theme';

/** User-facing text for a failed call. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const map = tr.groupErrors as Record<string, string>;
    return map[error.code] ?? tr.groupErrors.generic;
  }
  return tr.groupErrors.generic;
}

export function Message({ text, error = false, testID }: { text: string | null; error?: boolean; testID?: string }) {
  const c = usePalette();
  if (text === null) return null;
  return (
    <Label testID={testID} variant="small" style={error ? { color: c.danger } : undefined}>
      {text}
    </Label>
  );
}

/** "Label ... [Açık/Kapalı]" switch row built from the existing Button. */
export function ToggleRow({
  label,
  on,
  onToggle,
  disabled = false,
  testID,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Row>
      <Label style={{ flex: 1 }}>{label}</Label>
      <Button
        testID={testID}
        kind={on ? 'primary' : 'secondary'}
        title={on ? tr.groups.on : tr.groups.off}
        onPress={onToggle}
        disabled={disabled}
      />
    </Row>
  );
}

/** Whole hours left until an ISO timestamp (rounded up, at least 0). */
export function hoursLeft(iso: string | null, now: number): number {
  if (iso === null) return 0;
  const ms = Date.parse(iso) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 3_600_000)) : 0;
}

export function minutesLeft(iso: string | null, now: number): number {
  if (iso === null) return 0;
  const ms = Date.parse(iso) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 60_000)) : 0;
}
