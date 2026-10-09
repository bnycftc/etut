import { useState } from 'react';
import { View } from 'react-native';

import { MAX_SESSION_QUESTIONS, parseQuestionCount } from '../domain/questions';
import { tr } from '../strings';
import { Button, Field, Label, ResponsiveRow } from './components';
import { space, usePalette } from './theme';

/**
 * "Kaç soru çözdün? (isteğe bağlı)" after Bitir: one small number field with its own Kaydet.
 * Skipping it is the default; nothing waits for it. Empty or 0 clears a saved count.
 */
export function QuestionCount({ onSave, testID }: { onSave: (questions: number | null) => void; testID: string }) {
  const c = usePalette();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const save = () => {
    const parsed = parseQuestionCount(text);
    if (!parsed.ok) {
      setMessage({ text: tr.questions.invalid(MAX_SESSION_QUESTIONS), error: true });
      return;
    }
    onSave(parsed.value);
    setMessage({ text: parsed.value === null ? tr.questions.cleared : tr.questions.saved(parsed.value), error: false });
  };

  return (
    <View style={{ gap: space.xs }}>
      <ResponsiveRow>
        <Field
          testID={`${testID}-input`}
          label={tr.questions.finishLabel}
          value={text}
          onChange={(value) => {
            setText(value);
            setMessage(null);
          }}
          maxLength={4}
          placeholder={tr.questions.placeholder}
        />
        <View style={{ justifyContent: 'flex-end' }}>
          <Button compact testID={`${testID}-save`} kind="secondary" title={tr.questions.save} onPress={save} />
        </View>
      </ResponsiveRow>
      {message !== null ? (
        <Label
          variant="small"
          testID={`${testID}-message`}
          style={message.error ? { color: c.danger } : { color: c.success }}>
          {message.text}
        </Label>
      ) : null}
    </View>
  );
}
