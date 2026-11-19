import { Container, Stack, Text, Title } from '@mantine/core';
import { UploadForm } from '~/components/upload-form';

export default function HomePage() {
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1}>DSN workforce reporting</Title>
          <Text c="dimmed">
            Upload a DSN to pre-fill the S1‑6 workforce questions of your CSRD report. You can
            review and edit every answer before exporting it.
          </Text>
        </Stack>
        <UploadForm />
      </Stack>
    </Container>
  );
}
