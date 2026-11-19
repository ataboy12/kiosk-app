'use client';

import { List, Stack, Text } from '@mantine/core';
import { provenanceOf } from '~/form-state';
import { useAnswerForm, useFormState } from './answer-form-context';
import classes from './working-paper.module.css';

interface QuestionNotesProps {
  questionId: string;
  /** Names the row when several notes share one margin, as in a table. */
  label?: string;
  /** Leaves out the data-quality notes, which a table shows once for all its rows. */
  withoutNotes?: boolean;
}

/** The margin beside a question: how the DSN answered it, why it couldn't, or that it won't. */
export function QuestionNotes({ questionId, label, withoutNotes = false }: QuestionNotesProps) {
  const { failureOf, isLocked } = useAnswerForm();
  const state = useFormState();
  const failure = failureOf(questionId);
  const provenance = provenanceOf(state, questionId);

  return (
    <Stack gap={6}>
      {label !== undefined && <span className={classes.marginLabel}>{label}</span>}
      {isLocked(questionId) ? (
        <span>Computing from your DSN…</span>
      ) : failure !== undefined ? (
        <Text inherit c="ink.8" fw={500}>
          {failure}
        </Text>
      ) : provenance === undefined ? (
        <span>Your DSN doesn’t hold this information, so the answer is up to you.</span>
      ) : (
        <>
          <span>{provenance.method}</span>
          {!withoutNotes && <NoteList notes={provenance.notes} />}
          {provenance.rubriques.length > 0 && (
            <details className={classes.fields}>
              <summary>DSN fields read ({provenance.rubriques.length})</summary>
              {provenance.rubriques.join(', ')}
            </details>
          )}
        </>
      )}
    </Stack>
  );
}

/** The data-quality notes of several questions, each said once. */
export function SharedNotes({ questionIds }: { questionIds: readonly string[] }) {
  const state = useFormState();
  const notes = new Set(questionIds.flatMap((id) => provenanceOf(state, id)?.notes ?? []));
  return <NoteList notes={[...notes]} />;
}

function NoteList({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return (
    <List size="xs" spacing={4} c="ink.8">
      {notes.map((note) => (
        <List.Item key={note}>{note}</List.Item>
      ))}
    </List>
  );
}
