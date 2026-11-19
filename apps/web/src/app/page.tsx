import { Container, Stack, Text, Title } from '@mantine/core';
import { connection } from 'next/server';
import { countQuestions } from '~/server/questions';

// Placeholder until the upload flow (build step 4): proves the app reaches the seeded database.
export default async function HomePage() {
  await connection(); // Render per request: the page reads the database, never at build time.
  const questionCount = await countQuestions();

  return (
    <Container size="sm" py="xl">
      <Stack gap="xs">
        <Title order={1}>DSN workforce reporting</Title>
        <Text c="dimmed">
          Upload a DSN to pre-fill the S1‑6 workforce questions. {questionCount} questions loaded.
        </Text>
      </Stack>
    </Container>
  );
}
