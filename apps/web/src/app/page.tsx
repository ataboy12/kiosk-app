import { Stack, Text, Title } from '@mantine/core';
import { UploadForm } from '~/components/upload-form';
import classes from '~/components/working-paper.module.css';

export default function HomePage() {
  return (
    <main className={classes.narrowSheet}>
      <Stack gap="xl">
        <Stack gap="sm">
          <Title order={1}>Pre-fill your workforce report from a DSN</Title>
          <Text>
            Upload the monthly DSN from your payroll software. Head-counts, leavers and turnover for
            the S1‑6 questions of your CSRD report are computed from it, by contract type, gender,
            country, region and job category.
          </Text>
          <Text c="dimmed" size="sm">
            Every figure shows how it was computed, and you can change any of them before exporting
            to Word.
          </Text>
        </Stack>
        <UploadForm />
      </Stack>
    </main>
  );
}
