'use client';

import { Button, Group, List, Loader, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useTransition, type ReactNode } from 'react';
import { formatPeriod } from '~/format-period';
import type { Prefill, PrefillSummary } from '~/prefill';
import classes from './working-paper.module.css';

interface NoticeProps {
  tone: 'waiting' | 'ready' | 'warning' | 'error';
  title: ReactNode;
  children: ReactNode;
}

/**
 * A status message with a coloured rule, not a filled box. Not `role="alert"`: the polite live
 * region around it already announces it.
 */
function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div role="group" className={classes.notice} data-tone={tone}>
      <Stack gap={6}>
        <Text fw={600}>{title}</Text>
        {children}
      </Stack>
    </div>
  );
}

export function WaitingBanner() {
  return (
    <Notice
      tone="waiting"
      title={
        <Group gap="xs" component="span">
          <Loader size={14} color="ink" />
          Reading your DSN…
        </Group>
      }
    >
      <Text size="sm" c="dimmed">
        Questions marked “Waiting” unlock as soon as their answers are computed. You can fill in the
        other questions in the meantime.
      </Text>
    </Notice>
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
        <Notice tone="error" title="This DSN could not be read">
          <Text size="sm">{result.message}</Text>
          <Button component={Link} href="/" size="xs" w="fit-content">
            Upload another file
          </Button>
        </Notice>
      );
    case 'RETRY':
      return <RetryBanner message={result.message} />;
  }
}

function ReadyBanner({ summary, failureCount }: { summary: PrefillSummary; failureCount: number }) {
  const { employeeCount, prefilledCount, period, warnings, warningCount } = summary;
  const periodText = period ? ` for ${formatPeriod(period)}` : '';
  const hidden = warningCount - warnings.length;

  return (
    <Notice tone={failureCount > 0 || warningCount > 0 ? 'warning' : 'ready'} title="DSN read">
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
    </Notice>
  );
}

function RetryBanner({ message }: { message: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <Notice tone="warning" title="The answers are not ready">
      <Text size="sm">
        {message} Questions marked “Waiting” are filled in when you retry; what you typed is kept.
      </Text>
      <Button
        size="xs"
        w="fit-content"
        loading={retrying}
        onClick={() => startRetry(() => router.refresh())}
      >
        Retry
      </Button>
    </Notice>
  );
}
