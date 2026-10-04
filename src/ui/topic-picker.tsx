import { useState } from 'react';
import { View } from 'react-native';

import { topicGroupsForSubject, topicName } from '../domain/curriculum';
import type { YksArea } from '../domain/net';
import type { ExamType } from '../domain/profile';
import { tr } from '../strings';
import { Button, Chip, ChipRow, Label, Row } from './components';

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
      <Label variant="heading">{tr.topicPicker.title}</Label>
      <Row>
        <Label variant="muted" style={{ flex: 1 }}>
          {topicName(topicId) ?? tr.topicPicker.none}
        </Label>
        <View>
          <Button
            testID="topic-picker-toggle"
            kind="secondary"
            title={open ? tr.topicPicker.close : topicId ? tr.topicPicker.change : tr.topicPicker.pick}
            onPress={() => setOpen(!open)}
          />
        </View>
      </Row>
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
