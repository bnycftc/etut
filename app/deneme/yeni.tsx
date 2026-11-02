import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { istanbulDayKey } from '@/domain/istanbul-day';
import { examKindsFor, formatNet, totalNet } from '@/domain/net';
import { parsePrefill } from '@/domain/net-calc';
import { useAppState } from '@/state/app-state';
import { askForReviewIfDue } from '@/state/review-prompt';
import { setSavedExamNotice } from '@/state/saved-exam-notice';
import { newId } from '@/storage/db';
import { listMockExams, saveMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Label, Screen } from '@/ui/components';
import { ExamForm, type ExamFormInitial } from '@/ui/exam-form';
import { announce, hapticSuccess } from '@/ui/feedback';

export default function NewExamScreen() {
  const { profile, active, notifyDataChanged } = useAppState();
  // One id per form: a second "Kaydet" can never create a second exam.
  const [id] = useState(newId);
  // YKS: TYT and the AYT/YDT paper of the area; LGS and KPSS: their own paper; "Diğer": none.
  const kinds = examKindsFor(profile?.examType ?? 'YKS', profile?.yksArea ?? null);
  // From "Net hesapla": its paper and counts, dated today (ignored for a paper not offered here).
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const [initial] = useState<ExamFormInitial | undefined>(() => {
    const parsed = parsePrefill(prefill);
    if (parsed === null || !kinds.includes(parsed.kind)) return undefined;
    return { ...parsed, scope: 'genel', bransSectionId: null, takenOn: istanbulDayKey(Date.now()) };
  });

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
      initial={initial}
      onSave={(v) => {
        saveMockExam(
          { id, kind: v.kind, scope: v.scope, bransSectionId: v.bransSectionId, takenOn: v.takenOn, createdAt: Date.now() },
          v.scores,
        );
        // The list confirms the save ("11,5 net kaydedildi") and offers the analysis.
        setSavedExamNotice(id);
        notifyDataChanged('exams');
        hapticSuccess();
        announce(tr.exams.saved(formatNet(totalNet(v.scores, v.kind))));
        router.back();
        // App Store rating (X-7): from the 3rd saved exam on, as the form closes.
        void askForReviewIfDue(profile, active !== null, () => ({
          kind: 'exam_saved',
          examCount: listMockExams().length,
        }));
      }}
    />
  );
}
