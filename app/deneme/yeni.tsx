import { router } from 'expo-router';
import { useState } from 'react';

import { examKindsFor } from '@/domain/net';
import { useAppState } from '@/state/app-state';
import { newId } from '@/storage/db';
import { saveMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Label, Screen } from '@/ui/components';
import { ExamForm } from '@/ui/exam-form';

export default function NewExamScreen() {
  const { profile, notifyDataChanged } = useAppState();
  // One id per form: a second "Kaydet" can never create a second exam.
  const [id] = useState(newId);
  // YKS: TYT and the AYT/YDT paper of the area; LGS and KPSS: their own paper; "Diğer": none.
  const kinds = examKindsFor(profile?.examType ?? 'YKS', profile?.yksArea ?? null);

  if (kinds.length === 0) {
    return (
      <Screen>
        <Label variant="muted" testID="exam-no-form">
          {tr.exams.noFormNote}
        </Label>
      </Screen>
    );
  }

  return (
    <ExamForm
      kinds={kinds}
      onSave={(v) => {
        saveMockExam(
          { id, kind: v.kind, scope: v.scope, bransSectionId: v.bransSectionId, takenOn: v.takenOn, createdAt: Date.now() },
          v.scores,
        );
        notifyDataChanged();
        router.back();
      }}
    />
  );
}
