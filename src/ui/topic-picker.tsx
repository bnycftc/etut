import { useState } from 'react';
import { View } from 'react-native';

import { topicGroupsForSubject, topicName } from '../domain/curriculum';
import type { YksArea } from '../domain/net';
import type { ExamType } from '../domain/profile';
import { tr } from '../strings';
import { Button, Chip, ChipRow, Label, ResponsiveRow } from './components';

/** Optional topic choice for a subject. Renders nothing when the subject has no topic list. */
export function TopicPicker({
  examType,
  yksArea,
  subjectId,
  topicId,
  onChange,
}: {
  examType: ExamType;
  yksArea: YksArea | null;
  subjectId: string;
  topicId: string | null;
  onChange: (topicId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = topicGroupsForSubject(examType, yksArea, subjectId);
  if (groups.length === 0) return null;
  const showPaper = groups.length > 1;

  return (
    <View style={{ gap: 8 }}>
      {/* One compact row: the topic is optional, the subject and Başla stay the main path. */}
      <ResponsiveRow>
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Label variant="small">{tr.topicPicker.title}</Label>
          <Label variant="muted">{topicName(topicId) ?? tr.topicPicker.none}</Label>
        </View>
        <Button
          compact
          testID="topic-picker-toggle"
          kind="secondary"
          title={open ? tr.topicPicker.close : topicId ? tr.topicPicker.change : tr.topicPicker.pick}
          onPress={() => setOpen(!open)}
        />
      </ResponsiveRow>
      {open ? (
        <>
          {topicId !== null ? (
            <ChipRow>
              <Chip
                testID="topic-picker-clear"
                title={tr.topicPicker.clear}
                selected={false}
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
            </ChipRow>
          ) : null}
          {groups.map((g) => (
            <View key={g.paper ?? 'all'} style={{ gap: 6 }}>
              {showPaper && g.paper ? <Label variant="small">{g.paper}</Label> : null}
              <ChipRow>
                {g.topics.map((t) => (
                  <Chip
                    key={t.id}
                    testID={`topic-${t.id}`}
                    title={t.name}
                    selected={t.id === topicId}
                    onPress={() => {
                      onChange(t.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </ChipRow>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}
