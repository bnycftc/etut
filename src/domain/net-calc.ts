/**
 * The net calculator ("Net hesapla"): text boxes → section scores, and the hand-over of its values
 * to the new-exam form ("Deneme olarak kaydet"). The net rule itself is `net.ts`.
 */

import { EXAM_KINDS, EXAM_SECTIONS, type ExamKind, type SectionScore } from './net';

export interface CountEntry {
  correct: string;
  wrong: string;
}

/** Empty input counts as 0; anything else must be a whole number (NaN otherwise). */
export function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** Every section of the paper (a whole "genel" exam), from the boxes typed so far. */
export function scoresFromEntries(kind: ExamKind, entries: Readonly<Record<string, CountEntry>>): SectionScore[] {
  return EXAM_SECTIONS[kind].map((s) => ({
    sectionId: s.id,
    questions: s.questions,
    correct: parseCount(entries[s.id]?.correct ?? ''),
    wrong: parseCount(entries[s.id]?.wrong ?? ''),
  }));
}

/** What "Deneme olarak kaydet" passes to `deneme/yeni` (as a JSON route param). */
export interface ExamPrefill {
  kind: ExamKind;
  scores: { sectionId: string; correct: number; wrong: number }[];
}

export function encodePrefill(kind: ExamKind, scores: readonly SectionScore[]): string {
  const prefill: ExamPrefill = {
    kind,
    scores: scores.map((s) => ({ sectionId: s.sectionId, correct: s.correct, wrong: s.wrong })),
  };
  return JSON.stringify(prefill);
}

/**
 * The param back as full section scores of its paper; `null` for anything malformed (a hand-typed
 * link): an unknown paper, or a count that does not fit its section. Missing sections are empty.
 */
export function parsePrefill(text: unknown): { kind: ExamKind; scores: SectionScore[] } | null {
  if (typeof text !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { kind, scores } = value as { kind?: unknown; scores?: unknown };
  if (!EXAM_KINDS.includes(kind as ExamKind) || !Array.isArray(scores)) return null;
  const k = kind as ExamKind;
  const out: SectionScore[] = EXAM_SECTIONS[k].map((s) => ({
    sectionId: s.id,
    questions: s.questions,
    correct: 0,
    wrong: 0,
  }));
  for (const item of scores as unknown[]) {
    if (typeof item !== 'object' || item === null) return null;
    const { sectionId, correct, wrong } = item as Record<string, unknown>;
    const score = out.find((s) => s.sectionId === sectionId);
    if (score === undefined || !Number.isInteger(correct) || !Number.isInteger(wrong)) return null;
    const c = correct as number;
    const w = wrong as number;
    if (c < 0 || w < 0 || c + w > score.questions) return null;
    score.correct = c;
    score.wrong = w;
  }
  return { kind: k, scores: out };
}
