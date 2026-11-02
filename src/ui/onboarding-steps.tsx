/**
 * The four short steps of the first launch (app/onboarding.tsx holds the answers and the buttons):
 * (1) exam and area, (2) the countdown to the exam, (3) the optional daily goal, (4) the birth
 * year. Neutral pickers with nothing pre-selected (K-15); only the year is asked (K-19).
 */

import { useState } from 'react';

import { examDaysLeft, readExamDayInput, resolveExamDate } from '../domain/exam-dates';
import type { DayKey } from '../domain/istanbul-day';
import type { YksArea } from '../domain/net';
import { BIRTH_YEAR_FIRST_PAGE_MAX_AGE, birthYearOptions, EXAM_TYPES, type ExamType, YKS_AREAS } from '../domain/profile';
import { tr } from '../strings';
import { Button, Card, Chip, ChipRow, Field, Label, Row, Tag } from './components';
import { formatDay } from './format';
import { GoalPresets } from './goal-sheet';
import { usePalette } from './theme';

export const ONBOARDING_STEPS = 4;

export function ExamStep({
  examType,
  yksArea,
  onExam,
  onArea,
}: {
  examType: ExamType | null;
  yksArea: YksArea | null;
  onExam: (examType: ExamType) => void;
  onArea: (area: YksArea) => void;
}) {
  return (
    <>
      <Card>
        <Label variant="heading">{tr.onboarding.examTitle}</Label>
        <ChipRow>
          {EXAM_TYPES.map((t) => (
            <Chip key={t} testID={`exam-type-${t}`} title={tr.examType(t)} selected={t === examType} onPress={() => onExam(t)} />
          ))}
        </ChipRow>
      </Card>
      {examType === 'YKS' ? (
        <Card>
          <Label variant="heading">{tr.onboarding.areaTitle}</Label>
          <ChipRow>
            {YKS_AREAS.map((a) => (
              <Chip key={a} testID={`yks-area-${a}`} title={tr.yksArea(a)} selected={a === yksArea} onPress={() => onArea(a)} />
            ))}
          </ChipRow>
        </Card>
      ) : null}
    </>
  );
}

/**
 * The day the timer screen will count down to: the built-in date ("tahmini" when it is an
 * estimate) or the student's own. "Tarihi değiştir" takes a date here; it is saved with Başla.
 */
export function CountdownStep({
  examType,
  customDay,
  today,
  onCustomDay,
}: {
  examType: ExamType;
  customDay: DayKey | null;
  today: DayKey;
  onCustomDay: (day: DayKey) => void;
}) {
  const c = usePalette();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const date = resolveExamDate(examType, customDay, today);
  const left = date === null ? null : examDaysLeft(date, today);
  const change = (value: string, leftField = false) => {
    const day = readExamDayInput(value, text, today, leftField);
    setInvalid(day === 'invalid');
    if (day === null || day === 'invalid') {
      setText(value);
      return;
    }
    onCustomDay(day);
    setText('');
    setEditing(false);
  };
  return (
    <Card tone="hero">
      <Label variant="heading">{tr.onboarding.countdownTitle}</Label>
      {date !== null && left !== null && left >= 0 ? (
        <>
          <Label testID="onboarding-countdown" variant="largeTitle">
            {tr.countdown.days(examType, left)}
          </Label>
          <Row wrap>
            <Label testID="onboarding-exam-date">{formatDay(date.day)}</Label>
            {date.estimated ? <Tag title={tr.countdown.estimated} /> : null}
            {date.custom ? <Tag title={tr.countdown.custom} /> : null}
          </Row>
          <Label variant="small">{tr.onboarding.countdownHint}</Label>
        </>
      ) : (
        <Label testID="onboarding-countdown-none" variant="muted">
          {tr.onboarding.countdownNone}
        </Label>
      )}
      {editing ? (
        <>
          <Row>
            <Field
              testID="onboarding-exam-date-input"
              label={tr.countdown.input}
              value={text}
              onChange={(value) => change(value)}
              onBlur={() => change(text, true)}
              maxLength={10}
              numeric={false}
              placeholder={tr.countdown.placeholder}
            />
          </Row>
          {invalid ? (
            <Label variant="small" live style={{ color: c.danger }}>
              {tr.countdown.invalid}
            </Label>
          ) : null}
        </>
      ) : (
        <Button
          testID="onboarding-exam-date-change"
          kind="secondary"
          title={tr.onboarding.changeDate}
          onPress={() => setEditing(true)}
        />
      )}
    </Card>
  );
}

/** Optional: skipping it is simply not choosing. Tapping the chosen one again clears it. */
export function GoalStep({ goal, onGoal }: { goal: number | null; onGoal: (goal: number | null) => void }) {
  return (
    <Card>
      <Label variant="heading">{tr.goalSheet.onboardingTitle}</Label>
      <GoalPresets goal={goal} onPick={(minutes) => onGoal(goal === minutes ? null : minutes)} testIDPrefix="onboarding-goal" />
      <Label variant="small">{tr.goalSheet.onboardingHint}</Label>
    </Card>
  );
}

/** Neutral birth-year picker: nothing pre-selected, no age hints (K-15). */
export function BirthYearStep({
  birthYear,
  currentYear,
  onBirthYear,
}: {
  birthYear: number | null;
  currentYear: number;
  onBirthYear: (year: number) => void;
}) {
  const [allYears, setAllYears] = useState(false);
  return (
    <Card>
      <Label variant="heading">{tr.onboarding.birthYearTitle}</Label>
      <Label variant="small">{tr.onboarding.birthYearHint}</Label>
      {/* Part of the page, not a box that scrolls on its own: a swipe in the middle of the
          screen then scrolled the year list instead of the page, hiding the cards below. */}
      <ChipRow>
        {birthYearOptions(currentYear)
          .filter((y) => allYears || currentYear - y <= BIRTH_YEAR_FIRST_PAGE_MAX_AGE || y === birthYear)
          .map((y) => (
            <Chip key={y} testID={`birth-year-${y}`} title={String(y)} selected={y === birthYear} onPress={() => onBirthYear(y)} />
          ))}
      </ChipRow>
      {allYears ? null : (
        <Button testID="birth-year-more" kind="secondary" title={tr.onboarding.olderYears} onPress={() => setAllYears(true)} />
      )}
    </Card>
  );
}
