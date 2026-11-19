'use client';

import { Button, Group, Paper, Text, VisuallyHidden } from '@mantine/core';
import { useEffect, useState, useTransition } from 'react';
import { unsavedChanges } from '~/form-state';
import { saveAnswers } from '~/server/save-answers';
import type { SaveResult } from '~/server/store-answers';
import { useAnswerForm, useFormState } from './answer-form-context';

/** The request itself failed (network, server restart, new deploy): the values stay in the form. */
const UNREACHABLE: SaveResult = {
  ok: false,
  error: 'Your answers could not be saved. Check your connection and try again.',
};

interface SaveBarProps {
  importId: string;
  /** The stored answers have arrived: saving before would race the pre-fill. */
  ready: boolean;
}

/** Explicit save, kept in view at the bottom of the form. The user stays on the page. */
export function SaveBar({ importId, ready }: SaveBarProps) {
  const { dispatch } = useAnswerForm();
  const state = useFormState();
  const changes = unsavedChanges(state);
  const dirty = changes.length > 0;
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Only the outcome of a save is announced, not the change count that moves with each keystroke.
  const [announcement, setAnnouncement] = useState('');

  // Ask before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function save() {
    const sent = state.values;
    startSaving(async () => {
      // Never let a failed request reach the error boundary: it would reset the form.
      const result = await saveAnswers(importId, changes).catch(() => UNREACHABLE);
      if (result.ok) dispatch({ type: 'saved', values: sent });
      setError(result.ok ? null : result.error);
      setAnnouncement(result.ok ? 'Your answers are saved.' : result.error);
    });
  }

  return (
    <Paper withBorder shadow="sm" p="sm" pos="sticky" bottom={16} style={{ zIndex: 2 }}>
      <Group justify="space-between">
        <Text size="sm" c={error ? 'red' : 'dimmed'}>
          {statusText({ saving, error, ready, changeCount: changes.length })}
        </Text>
        <VisuallyHidden aria-live="polite">{saving ? 'Saving…' : announcement}</VisuallyHidden>
        <Button onClick={save} loading={saving} disabled={!ready || !dirty}>
          Save
        </Button>
      </Group>
    </Paper>
  );
}

interface SaveStatus {
  saving: boolean;
  error: string | null;
  ready: boolean;
  changeCount: number;
}

function statusText({ saving, error, ready, changeCount }: SaveStatus): string {
  if (saving) return 'Saving…';
  if (error) return error;
  if (!ready) return 'You can save once your DSN has been read. What you type is kept.';
  if (changeCount === 0) return 'All changes saved.';
  return changeCount === 1 ? '1 unsaved change.' : `${changeCount} unsaved changes.`;
}
