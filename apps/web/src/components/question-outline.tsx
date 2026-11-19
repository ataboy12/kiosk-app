'use client';

import type { QuestionNode } from '@kiosk/questionnaire';
import { Badge, Group, Loader, Paper, Stack, Text, Title, Tooltip } from '@mantine/core';
import type { Prefill } from '~/prefill';

/*
 * Read-only outline of the questions and their pre-fill state. Build step 5 replaces it with the
 * editable form (inputs, tables, saving); the locked/waiting states shown here carry over.
 */

interface QuestionOutlineProps {
  questions: QuestionNode[];
  mappedQuestionIds: string[];
  /** `null` while the DSN is still being processed. */
  prefill: Prefill | null;
}

export function QuestionOutline({ questions, mappedQuestionIds, prefill }: QuestionOutlineProps) {
  const mapped = new Set(mappedQuestionIds);
  // On RETRY the computation may still finish, so mapped questions stay locked until it has.
  const waiting = prefill === null || prefill.status === 'RETRY';
  return (
    <Stack gap="md">
      {questions.map((section) => (
        <Paper key={section.id} withBorder p="md">
          <Stack gap="sm">
            <Title order={2} size="h4">
              {section.labelEn}
            </Title>
            {section.children.map((question) => (
              <QuestionLine
                key={question.id}
                question={question}
                locked={mapped.has(question.id) && waiting}
                prefill={prefill}
              />
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

interface QuestionLineProps {
  question: QuestionNode;
  locked: boolean;
  prefill: Prefill | null;
}

function QuestionLine({ question, locked, prefill }: QuestionLineProps) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2}>
        <Text size="sm">{question.labelEn}</Text>
        {!locked && prefill?.status === 'READY' && (
          <Text size="sm" c="dimmed">
            {valuesText(question, prefill)}
          </Text>
        )}
      </Stack>
      <StateBadge question={question} locked={locked} prefill={prefill} />
    </Group>
  );
}

function StateBadge({ question, locked, prefill }: QuestionLineProps) {
  if (locked) {
    return (
      <Tooltip label="This answer is being computed from your DSN.">
        <Badge variant="light" color="blue" leftSection={<Loader size={10} />}>
          Waiting
        </Badge>
      </Tooltip>
    );
  }
  if (prefill?.status !== 'READY') return <Badge variant="outline">To fill in</Badge>;

  const failure = prefill.failures.find((f) => f.questionId === question.id);
  if (failure) {
    return (
      <Tooltip label={failure.message} multiline w={280}>
        <Badge variant="light" color="yellow">
          Not computed
        </Badge>
      </Tooltip>
    );
  }
  return prefill.answers.some((a) => a.questionId === question.id && a.provenance !== null) ? (
    <Badge variant="light" color="teal">
      Pre-filled
    </Badge>
  ) : (
    <Badge variant="outline">To fill in</Badge>
  );
}

/** The question's values, one per table column: "Male – Permanent: 30 · Female – Permanent: 28". */
function valuesText(question: QuestionNode, prefill: Extract<Prefill, { status: 'READY' }>) {
  const columns = (question.parentId !== null && prefill.columns[question.parentId]) || [];
  const labelOf = (key: string) => columns.find((c) => c.key === key)?.label;
  return prefill.answers
    .filter((a) => a.questionId === question.id && a.value !== null)
    .map((a) => {
      const label = labelOf(a.columnKey);
      return label && columns.length > 1 ? `${label}: ${a.value}` : String(a.value);
    })
    .join(' · ');
}
