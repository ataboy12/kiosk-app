'use server';

import 'server-only';

import { redirect } from 'next/navigation';
import { readDsnFile } from './dsn-file';
import { createImport } from './imports';

export interface UploadState {
  /** Business-language reason the file was refused, or `null`. */
  error: string | null;
}

/**
 * Upload form action: checks the file quickly, stores it as a PROCESSING import and redirects to
 * its page at once. The DSN is parsed there, while the form is already on screen.
 */
export async function uploadDsn(_state: UploadState, formData: FormData): Promise<UploadState> {
  const file = await readDsnFile(formData.get('file'));
  if (!file.ok) return { error: file.error };

  const id = await createImport(file.fileName, file.content);
  redirect(`/imports/${id}`);
}
