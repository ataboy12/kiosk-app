'use client';

import { Alert, Button, Group, List, Loader, Stack, Text, type AlertProps } from '@mantine/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useTransition } from 'react';
import type { Prefill, PrefillSummary } from '~/prefill';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * A status banner. Mantine's Alert defaults to `role="alert"`, which would make screen readers
 * announce it a second time, assertively: the polite live region around it already does.
 */
function Banner(props: AlertProps) {
  return <Alert role="group" {...props} />;
}

export function WaitingBanner() {
  return (
    <Banner color="blue" title="Reading your DSN…" icon={<Loader size="sm" />}>
      Questions marked “Waiting” unlock as soon as their answers are computed. You can fill in the
      other questions in the meantime.
    </Banner>
  );
}

interface PrefillStatusProps {
  prefill: Promise<Prefill>;
  /** Hands the result to the form once it has arrived. */
  onSettled: (prefill: Prefill) => void;
}

/** Suspends until the DSN is processed, then reports the outcome and its next step. */
export function PrefillStatus({ prefill, onSettled }: PrefillStatusProps) {
  const result = use(prefill);
  useEffect(() => onSettled(result), [result, onSettled]);

  switch (result.status) {
    case 'READY':
      return <ReadyBanner summary={result.summary} failureCount={result.failures.length} />;
    case 'FAILED':
      return (
        <Banner color="red" title="This DSN could not be read">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">{result.message}</Text>
            <Button component={Link} href="/" size="xs">
              Upload another file
            </Button>
          </Stack>
        </Banner>
      );
    case 'RETRY':
      return <RetryBanner message={result.message} />;
  }
}

function ReadyBanner({ summary, failureCount }: { summary: PrefillSummary; failureCount: number }) {
  const { employeeCount, prefilledCount, period, warnings, warningCount } = summary;
  const periodText = period
    ? ` for ${dateFormat.format(new Date(period.start))} – ${dateFormat.format(new Date(period.end))}`
    : '';
  const hidden = warningCount - warnings.length;

  return (
    <Banner color={failureCount > 0 || warningCount > 0 ? 'yellow' : 'teal'} title="DSN read">
      <Stack gap="xs">
        <Text size="sm">
          {employeeCount} employees found{periodText}. {prefilledCount} questions pre-filled
          {failureCount > 0 ? `, ${failureCount} could not be computed and are left for you` : ''}.
          Check the values below before exporting.
        </Text>
        {warningCount > 0 && (
          <>
            <Text size="sm">Some lines of the file could not be used:</Text>
            <List size="sm">
              {warnings.map((warning, index) => (
                <List.Item key={`${warning.line}-${index}`}>{warning.message}</List.Item>
              ))}
            </List>
            {hidden > 0 && <Text size="sm">…and {hidden} more.</Text>}
          </>
        )}
      </Stack>
    </Banner>
  );
}

function RetryBanner({ message }: { message: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <Banner color="yellow" title="The answers are not ready">
      <Group justify="space-between">
        <Text size="sm">
          {message} Questions marked “Waiting” are filled in when you retry; what you typed is kept.
        </Text>
        <Button size="xs" loading={retrying} onClick={() => startRetry(() => router.refresh())}>
          Retry
        </Button>
      </Group>
    </Banner>
  );
}
