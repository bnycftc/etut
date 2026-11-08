import { useState } from 'react';
import { View } from 'react-native';

import { topicOfSubject } from '@/domain/curriculum';
import { addDays, DAY_MS, dayStartMs, istanbulDayKey, istanbulTimeOfDay } from '@/domain/istanbul-day';
import {
  buildManualSession,
  durationFields,
  earliestManualDay,
  justFinishedStart,
  MANUAL_DURATION_CHIPS,
  MANUAL_MIN_MS,
  type ManualEntryError,
  parseDurationFields,
  parseStartTime,
  type TimeSpan,
  validateManualEntry,
} from '@/domain/manual-entry';
import { MAX_SESSION_QUESTIONS, parseQuestionCount } from '@/domain/questions';
import { defaultSubject, subjectsFor } from '@/domain/subjects';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { newId } from '@/storage/db';
import { loadLastSubject } from '@/storage/kv';
import {
  deleteManualSession,
  recentManualSessions,
  saveSession,
  sessionsOverlapping,
} from '@/storage/sessions';
import { tr } from '@/strings';
import { syncFinishedSession, syncManualDeleted } from '@/sync/session-sync';
import { Button, Card, Chip, ChipRow, Field, Label, PeriodNav, ResponsiveRow, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration, topicLabel } from '@/ui/format';
import { usePalette } from '@/ui/theme';
import { TopicPicker } from '@/ui/topic-picker';

const RECENT_LIMIT = 10;

/** `11:15` (Istanbul time). */
function clockLabel(ms: number): string {
  const { hours, minutes } = istanbulTimeOfDay(ms);
  return tr.reminders.time(hours, minutes);
}

/** "Sayacı açmayı unuttum": add a past session by hand (saved as `source = 'manual'`). */
export default function ManualEntryScreen() {
  const { profile, active, dataVersions, notifyDataChanged } = useAppState();
  const c = usePalette();
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  // A render clock, not Date.now() (the React Compiler would compute it once per mount).
  const now = useNow(false);
  const today = istanbulDayKey(now);

  const subjects = subjectsFor(examType, yksArea);
  const [pickedSubject, setSubjectId] = useState(() => defaultSubject(examType, loadLastSubject(), yksArea));
  const subjectId = subjects.includes(pickedSubject) ? pickedSubject : (subjects[0] ?? pickedSubject);
  const [pickedTopic, setTopicId] = useState<string | null>(null);
  const topicId = topicOfSubject(examType, yksArea, subjectId, pickedTopic);
  const [day, setDay] = useState(today);
  const [startH, setStartH] = useState('');
  const [startM, setStartM] = useState('');
  const [durH, setDurH] = useState('');
  const [durM, setDurM] = useState('');
  // Today the entry ends "az önce" (now) unless the student opens the time fields ("Saati değiştir").
  const [customTime, setCustomTime] = useState(false);
  const justFinished = day === today && !customTime;
  const durationMs = parseDurationFields(durH, durM);
  const [questionsText, setQuestionsText] = useState('');
  const [questionsError, setQuestionsError] = useState(false);
  const [error, setError] = useState<ManualEntryError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Each tap on Ekle reads its result out again, also when it is the same message.
  const [attempt, setAttempt] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const recent = useStored(String(dataVersions.sessions), () => recentManualSessions(RECENT_LIMIT));
  // Sessions an "Az önce bitti" entry could run into: the days it may start on, up to the end of today.
  const nearby = useStored(`${dataVersions.sessions}|${today}`, () =>
    sessionsOverlapping(dayStartMs(earliestManualDay(now)), dayStartMs(today) + DAY_MS),
  );
  const nearbyTaken: TimeSpan[] =
    active === null ? nearby : [...nearby, { startedAt: active.startedAt, endedAt: now }];
  // Shown below "Ne zaman?"; Ekle works the span out again at the moment of the tap.
  const shownStart =
    justFinished && durationMs !== null && durationMs > 0 ? justFinishedStart(now, durationMs, nearbyTaken) : null;
  // It ends before now: another record (usually the timer session just saved) is in the way.
  const shownMoved = shownStart !== null && durationMs !== null && shownStart + durationMs < now - (now % MANUAL_MIN_MS);

  const add = () => {
    setAttempt((n) => n + 1);
    setMessage(null);
    const now = Date.now();
    // Read again at the tap: the span shown above can be up to a minute old.
    const taken = (): TimeSpan[] => {
      const spans = sessionsOverlapping(dayStartMs(earliestManualDay(now)), now);
      return active === null ? spans : [...spans, { startedAt: active.startedAt, endedAt: now }];
    };
    const startMs =
      durationMs === null
        ? null
        : justFinished
          ? justFinishedStart(now, durationMs, taken())
          : parseStartTime(day, startH, startM);
    if (durationMs !== null && justFinished && startMs === null) {
      // No free span of this length in the last days: the hint below says what to change.
      setError('overlap');
      return;
    }
    if (startMs === null || durationMs === null) {
      setError('invalid');
      return;
    }
    const questions = parseQuestionCount(questionsText);
    setQuestionsError(!questions.ok);
    if (!questions.ok) {
      setError(null);
      return;
    }
    const input = { subjectId, topicId, startMs, durationMs, questions: questions.value };
    const existing: TimeSpan[] = sessionsOverlapping(startMs, startMs + durationMs);
    if (active !== null) existing.push({ startedAt: active.startedAt, endedAt: now });
    const problem = validateManualEntry(input, existing, now);
    setError(problem);
    if (problem !== null) return;
    const session = buildManualSession(newId(), input);
    saveSession(session, now);
    syncFinishedSession(session, now);
    notifyDataChanged('sessions');
    setMessage(tr.manual.added(formatDuration(durationMs)));
    setStartH('');
    setStartM('');
    setDurH('');
    setDurM('');
    setQuestionsText('');
  };

  return (
    <Screen>
      <Label variant="muted">{tr.manual.intro}</Label>

      <Card>
        <Label variant="heading">{tr.manual.subject}</Label>
        <ChipRow>
          {subjects.map((id) => (
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
        <PeriodNav
          label={day === today ? tr.history.todayLabel : formatDay(day)}
          prev={{
            testID: 'manual-prev-day',
            title: tr.exams.prevDay,
            disabled: day <= earliestManualDay(now),
            onPress: () => setDay(addDays(day, -1)),
          }}
          next={{
            testID: 'manual-next-day',
            title: tr.exams.nextDay,
            disabled: day >= today,
            onPress: () => setDay(addDays(day, 1)),
          }}
        />

        <Label variant="heading">{tr.manual.duration}</Label>
        <ChipRow>
          {MANUAL_DURATION_CHIPS.map((minutes) => (
            <Chip
              key={minutes}
              testID={`manual-duration-chip-${minutes}`}
              title={tr.manual.chipMinutes(minutes)}
              selected={durationMs === minutes * MANUAL_MIN_MS}
              onPress={() => {
                const fields = durationFields(minutes);
                setDurH(fields.hours);
                setDurM(fields.minutes);
              }}
            />
          ))}
        </ChipRow>
        <Row>
          <Field
            testID="manual-duration-hours"
            label={tr.manual.hours}
            accessibilityLabel={tr.manual.fieldA11y(tr.manual.duration, tr.manual.hours)}
            value={durH}
            onChange={setDurH}
            maxLength={2}
            placeholder={tr.manual.placeholders.durationHours}
          />
          <Field
            testID="manual-duration-minutes"
            label={tr.manual.minutes}
            accessibilityLabel={tr.manual.fieldA11y(tr.manual.duration, tr.manual.minutes)}
            value={durM}
            onChange={setDurM}
            maxLength={2}
            placeholder={tr.manual.placeholders.durationMinutes}
          />
        </Row>

        <Label variant="heading">{tr.manual.timeTitle}</Label>
        {justFinished ? (
          <>
            <Label testID="manual-just-finished">
              {shownStart !== null && durationMs !== null
                ? tr.manual.justFinishedSpan(clockLabel(shownStart), clockLabel(shownStart + durationMs))
                : tr.manual.justFinished}
            </Label>
            {shownMoved ? (
              <Label variant="small" testID="manual-moved-before">
                {tr.manual.movedBefore}
              </Label>
            ) : null}
            <Button
              testID="manual-change-time"
              kind="secondary"
              title={tr.manual.changeTime}
              onPress={() => setCustomTime(true)}
            />
          </>
        ) : (
          <>
            <Label variant="muted">{tr.manual.start}</Label>
            <Row>
              <Field
                testID="manual-start-hour"
                label={tr.manual.hour}
                accessibilityLabel={tr.manual.fieldA11y(tr.manual.start, tr.manual.hour)}
                value={startH}
                onChange={setStartH}
                maxLength={2}
                placeholder={tr.manual.placeholders.startHour}
              />
              <Field
                testID="manual-start-minute"
                label={tr.manual.minute}
                accessibilityLabel={tr.manual.fieldA11y(tr.manual.start, tr.manual.minute)}
                value={startM}
                onChange={setStartM}
                maxLength={2}
                placeholder={tr.manual.placeholders.startMinute}
              />
            </Row>
            {day === today ? (
              <Button
                testID="manual-use-just-finished"
                kind="secondary"
                title={tr.manual.justFinished}
                onPress={() => setCustomTime(false)}
              />
            ) : null}
          </>
        )}
        <Label variant="small">{tr.manual.limits}</Label>

        <Row>
          <Field
            testID="manual-questions"
            label={tr.questions.manualLabel}
            value={questionsText}
            onChange={setQuestionsText}
            maxLength={4}
            placeholder={tr.questions.placeholder}
          />
        </Row>
        {questionsError ? (
          <Label testID="manual-questions-error" live={attempt} variant="small" style={{ color: c.danger }}>
            {tr.questions.invalid(MAX_SESSION_QUESTIONS)}
          </Label>
        ) : null}
      </Card>

      {error !== null ? (
        <Label testID="manual-error" live={attempt} style={{ color: c.danger }}>
          {tr.manual.errors[error]}
        </Label>
      ) : null}
      {error === 'overlap' ? (
        <Label testID="manual-overlap-hint" variant="small">
          {tr.manual.overlapHint}
        </Label>
      ) : null}
      {message !== null ? <Label testID="manual-added" live={attempt}>{message}</Label> : null}
      <Button testID="manual-add" large title={tr.manual.add} onPress={add} />

      <Label variant="heading">{tr.manual.recent}</Label>
      {recent.length === 0 ? <Label variant="muted">{tr.manual.empty}</Label> : null}
      {recent.map((s) => {
        const { hours, minutes } = istanbulTimeOfDay(s.startedAt);
        const topic = topicLabel(s.topicId);
        const entry = `${tr.subject(s.subjectId)}${topic ? ` · ${topic}` : ''}`;
        const when = tr.manual.when(formatDay(istanbulDayKey(s.startedAt)), hours, minutes);
        // Every entry has its own "Sil": its name says which one.
        const deleteLabel = tr.manual.deleteA11y(entry, when, formatDuration(s.durationMs));
        return (
          <Card key={s.id}>
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Label>{entry}</Label>
                <Label variant="small">{when}</Label>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Label>{formatDuration(s.durationMs)}</Label>
                {s.questions !== undefined ? <Label variant="small">{tr.questions.count(s.questions)}</Label> : null}
              </View>
              <Tag title={tr.manualTag} />
            </Row>
            {confirmingId === s.id ? (
              <>
                <Label>{tr.manual.deleteConfirm}</Label>
                <ResponsiveRow>
                  <Button
                    testID={`manual-delete-yes-${s.id}`}
                    kind="danger"
                    title={tr.common.delete}
                    accessibilityLabel={deleteLabel}
                    onPress={() => {
                      deleteManualSession(s.id);
                      syncManualDeleted(s.id);
                      setConfirmingId(null);
                      notifyDataChanged('sessions');
                    }}
                  />
                  <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirmingId(null)} />
                </ResponsiveRow>
              </>
            ) : (
              <Button
                testID={`manual-delete-${s.id}`}
                kind="secondary"
                title={tr.common.delete}
                accessibilityLabel={deleteLabel}
                onPress={() => setConfirmingId(s.id)}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
