import { Alert, Anchor, Container, Group, Stack, Text, Title } from '@mantine/core';
import { MAPPED_QUESTION_IDS } from '@kiosk/questionnaire';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ImportWorkspace } from '~/components/import-workspace';
import { EXPORT_ERROR_PARAM, exportErrorMessage } from '~/export-errors';
import { QUESTIONNAIRE_TITLE } from '~/questionnaire-title';
import { getImport, processImport } from '~/server/imports';
import { getQuestionTree } from '~/server/questions';

export default async function ImportPage({ params, searchParams }: PageProps<'/imports/[id]'>) {
  await connection(); // Render per request: the page reads the database, never at build time.
  const { id } = await params;
  // Set by the export route when it couldn't give the Word file.
  const exportError = exportErrorMessage((await searchParams)[EXPORT_ERROR_PARAM]);
  const [dsnImport, questions] = await Promise.all([getImport(id), getQuestionTree()]);
  if (!dsnImport) notFound();

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={1}>{QUESTIONNAIRE_TITLE}</Title>
            <Text c="dimmed">From {dsnImport.fileName}</Text>
          </Stack>
          {/* A plain link: a server component can't pass `Link` to Mantine's client components. */}
          <Anchor href="/">Upload another file</Anchor>
        </Group>
        {exportError && (
          <Alert color="red" title="The export didn't work">
            {exportError}
          </Alert>
        )}
        {/* Not awaited: the questions render now and the answers stream in when ready. */}
        <ImportWorkspace
          importId={id}
          questions={questions}
          mappedQuestionIds={[...MAPPED_QUESTION_IDS]}
          prefill={processImport(id)}
        />
      </Stack>
    </Container>
  );
}
