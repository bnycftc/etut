import { useState } from 'react';
import { View } from 'react-native';

import { topicName } from '@/domain/curriculum';
import { addDays, istanbulDayKey, istanbulTimeOfDay } from '@/domain/istanbul-day';
import {
  buildManualSession,
  earliestManualDay,
  type ManualEntryError,
  parseDurationFields,
  parseStartTime,
  type TimeSpan,
  validateManualEntry,
} from '@/domain/manual-entry';
import { defaultSubject, SUBJECTS_BY_EXAM } from '@/domain/subjects';
import { useAppState, useStored } from '@/state/app-state';
import { newId } from '@/storage/db';
import { loadLastSubject } from '@/storage/kv';
import {
  deleteManualSession,
  recentManualSessions,
  saveSession,
  sessionsOverlapping,
} from '@/storage/sessions';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Field, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { usePalette } from '@/ui/theme';
import { TopicPicker } from '@/ui/topic-picker';

const RECENT_LIMIT = 10;

/** "Sayacı açmayı unuttum": add a past session by hand (saved as `source = 'manual'`). */
export default function ManualEntryScreen() {
  const { profile, active, dataVersion, notifyDataChanged } = useAppState();
  const c = usePalette();
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const today = istanbulDayKey(Date.now());

  const [subjectId, setSubjectId] = useState(() => defaultSubject(examType, loadLastSubject()));
  const [topicId, setTopicId] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [startH, setStartH] = useState('');
  const [startM, setStartM] = useState('');
  const [durH, setDurH] = useState('');
  const [durM, setDurM] = useState('');
  const [error, setError] = useState<ManualEntryError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const recent = useStored(String(dataVersion), () => recentManualSessions(RECENT_LIMIT));

  const add = () => {
    setMessage(null);
    const now = Date.now();
    const startMs = parseStartTime(day, startH, startM);
    const durationMs = parseDurationFields(durH, durM);
    if (startMs === null || durationMs === null) {
      setError('invalid');
      return;
    }
    const input = { subjectId, topicId, startMs, durationMs };
    const existing: TimeSpan[] = sessionsOverlapping(startMs, startMs + durationMs);
    if (active !== null) existing.push({ startedAt: active.startedAt, endedAt: now });
    const problem = validateManualEntry(input, existing, now);
    setError(problem);
    if (problem !== null) return;
    saveSession(buildManualSession(newId(), input), now);
    notifyDataChanged();
    setMessage(tr.manual.added(formatDuration(durationMs)));
    setStartH('');
    setStartM('');
    setDurH('');
    setDurM('');
  };

  return (
    <Screen>
      <Label variant="muted">{tr.manual.intro}</Label>

      <Card>
        <Label variant="heading">{tr.manual.subject}</Label>
        <ChipRow>
          {SUBJECTS_BY_EXAM[examType].map((id) => (
            <Chip
              key={id}
              testID={`manual-subject-${id}`}
              title={tr.subject(id)}
              selected={id === subjectId}
              onPress={() => {
                if (id !== subjectId) setTopicId(null);
                setSubjectId(id);
              }}
            />
          ))}
        </ChipRow>
        <TopicPicker
          examType={examType}
          yksArea={yksArea}
          subjectId={subjectId}
          topicId={topicId}
          onChange={setTopicId}
        />
      </Card>

      <Card>
        <Label variant="heading">{tr.manual.day}</Label>
        <Row>
          <Button
            testID="manual-prev-day"
            kind="secondary"
            title={tr.exams.prevDay}
            disabled={day <= earliestManualDay(Date.now())}
            onPress={() => setDay(addDays(day, -1))}
          />
          <Button
            testID="manual-next-day"
            kind="secondary"
            title={tr.exams.nextDay}
            disabled={day >= today}
            onPress={() => setDay(addDays(day, 1))}
          />
        </Row>
        <Label variant="muted">{day === today ? tr.history.todayLabel : formatDay(day)}</Label>

        <Label variant="heading">{tr.manual.start}</Label>
        <Row>
          <Field
            testID="manual-start-hour"
            label={tr.manual.hour}
            value={startH}
            onChange={setStartH}
            maxLength={2}
            placeholder={tr.manual.placeholders.startHour}
          />
          <Field
            testID="manual-start-minute"
            label={tr.manual.minute}
            value={startM}
            onChange={setStartM}
            maxLength={2}
            placeholder={tr.manual.placeholders.startMinute}
          />
        </Row>

        <Label variant="heading">{tr.manual.duration}</Label>
        <Row>
          <Field
            testID="manual-duration-hours"
            label={tr.manual.hours}
            value={durH}
            onChange={setDurH}
            maxLength={2}
            placeholder={tr.manual.placeholders.durationHours}
          />
          <Field
            testID="manual-duration-minutes"
            label={tr.manual.minutes}
            value={durM}
            onChange={setDurM}
            maxLength={2}
            placeholder={tr.manual.placeholders.durationMinutes}
          />
        </Row>
        <Label variant="small">{tr.manual.limits}</Label>
      </Card>

      {error !== null ? (
        <Label testID="manual-error" style={{ color: c.danger }}>
          {tr.manual.errors[error]}
        </Label>
      ) : null}
      {message !== null ? <Label testID="manual-added">{message}</Label> : null}
      <Button testID="manual-add" large title={tr.manual.add} onPress={add} />

      <Label variant="heading">{tr.manual.recent}</Label>
      {recent.length === 0 ? <Label variant="muted">{tr.manual.empty}</Label> : null}
      {recent.map((s) => {
        const { hours, minutes } = istanbulTimeOfDay(s.startedAt);
        const topic = topicName(s.topicId);
        return (
          <Card key={s.id}>
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Label>
                  {tr.subject(s.subjectId)}
                  {topic ? ` · ${topic}` : ''}
                </Label>
                <Label variant="small">
                  {tr.manual.when(formatDay(istanbulDayKey(s.startedAt)), hours, minutes)}
                </Label>
              </View>
              <Label>{formatDuration(s.durationMs)}</Label>
              <Tag title={tr.manualTag} />
            </Row>
            {confirmingId === s.id ? (
              <>
                <Label>{tr.manual.deleteConfirm}</Label>
                <Row>
                  <Button
                    testID={`manual-delete-yes-${s.id}`}
                    kind="danger"
                    title={tr.common.delete}
                    onPress={() => {
                      deleteManualSession(s.id);
                      setConfirmingId(null);
                      notifyDataChanged();
                    }}
                  />
                  <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirmingId(null)} />
                </Row>
              </>
            ) : (
              <Button
                testID={`manual-delete-${s.id}`}
                kind="secondary"
                title={tr.common.delete}
                onPress={() => setConfirmingId(s.id)}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
