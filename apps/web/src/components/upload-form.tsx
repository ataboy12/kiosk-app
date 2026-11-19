'use client';

import { Button, FileInput, Stack, Text } from '@mantine/core';
import { useActionState, useState } from 'react';
import { fileSizeError } from '~/server/dsn-file';
import { uploadDsn, type UploadState } from '~/server/upload-dsn';

/** The required first step: nothing else is reachable until a DSN is uploaded. */
export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadDsn, { error: null });
  const [file, setFile] = useState<File | null>(null);
  // Checked before sending: a file over the server's body limit would never reach the action.
  const [sizeError, setSizeError] = useState<string | null>(null);
  // Choosing another file hides the previous refusal; a new refusal is a new state, so it shows.
  const [dismissed, setDismissed] = useState<UploadState | null>(null);

  // The file comes from state, not from the form: React resets the form's file input after
  // each submission, while the picker keeps showing the chosen file.
  function submit() {
    if (file === null) return;
    const data = new FormData();
    data.set('file', file);
    formAction(data);
  }

  return (
    <form action={submit}>
      <Stack gap="md" align="flex-start">
        <FileInput
          label="DSN file"
          description="The monthly DSN exported from your payroll software (a .txt or .dsn file)."
          placeholder="Choose a file"
          accept=".txt,.dsn,text/plain"
          value={file}
          onChange={(chosen) => {
            const tooLarge = chosen && fileSizeError(chosen);
            setFile(tooLarge ? null : chosen);
            setSizeError(tooLarge || null);
            setDismissed(state);
          }}
          error={sizeError ?? (dismissed === state ? null : state.error)}
          clearable
          w="100%"
          maw={480}
        />
        <Button type="submit" loading={pending} disabled={file === null}>
          Upload and pre-fill
        </Button>
        <Text size="sm" c="dimmed" aria-live="polite">
          {pending ? 'Checking your file…' : null}
        </Text>
      </Stack>
    </form>
  );
}
