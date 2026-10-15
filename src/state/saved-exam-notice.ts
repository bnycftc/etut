import { useSyncExternalStore } from 'react';

/**
 * The exam the new-exam form has just saved, so the exam list can confirm it once the form
 * closes ("11,5 net kaydedildi"). Memory only and one exam at a time: cleared when the student
 * closes the card or leaves the list, gone after a restart.
 */
let savedExamId: string | null = null;
const listeners = new Set<() => void>();

export function setSavedExamNotice(id: string | null): void {
  if (id === savedExamId) return;
  savedExamId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): string | null {
  return savedExamId;
}

export function useSavedExamNotice(): string | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
