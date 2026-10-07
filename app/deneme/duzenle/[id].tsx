import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { examKindsFor } from '@/domain/net';
import { useAppState } from '@/state/app-state';
import { getMockExam, updateMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Label, Screen } from '@/ui/components';
import { ExamForm } from '@/ui/exam-form';

/** Corrects a saved exam (paper, type, date, counts); the topic analysis stays with it. */
export default function EditExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, notifyDataChanged } = useAppState();
  // Read once: the form keeps its own state while the student types.
  const [exam] = useState(() => (id ? getMockExam(id) : null));

  if (exam === null) {
    return (
      <Screen>
        <Label variant="muted">{tr.exams.notFound}</Label>
      </Screen>
    );
  }

  // The student's papers, plus the exam's own one (e.g. saved before an area change).
  const own = examKindsFor(profile?.examType ?? 'YKS', profile?.yksArea ?? null);
  const kinds = own.includes(exam.kind) ? own : [exam.kind, ...own];

  return (
    <ExamForm
      kinds={kinds}
      initial={exam}
      note={tr.exams.editNote}
      onSave={(v) => {
        updateMockExam(
          exam.id,
          { kind: v.kind, scope: v.scope, bransSectionId: v.bransSectionId, takenOn: v.takenOn },
          v.scores,
          Date.now(),
        );
        notifyDataChanged();
        router.back();
      }}
    />
  );
}
