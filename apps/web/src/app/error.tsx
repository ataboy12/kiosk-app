'use client';

import { Button, Container, Stack, Text, Title } from '@mantine/core';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container size="sm" py="xl">
      <Stack gap="sm" align="flex-start">
        <Title order={2}>Something went wrong</Title>
        <Text c="dimmed">The page could not be loaded. Your data has not been changed.</Text>
        <Button onClick={reset}>Try again</Button>
      </Stack>
    </Container>
  );
}
