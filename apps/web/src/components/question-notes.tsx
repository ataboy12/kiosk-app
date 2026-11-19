'use client';

import type { Provenance } from '@kiosk/questionnaire';
import { Button, Code, Group, List, Popover, Stack, Text } from '@mantine/core';
import { provenanceOf } from '~/form-state';
import { useAnswerForm, useFormState } from './answer-form-context';

/** Under a question: why the DSN couldn't answer it, or how it did. */
export function QuestionNotes({ questionId }: { questionId: string }) {
  const { failureOf } = useAnswerForm();
  const state = useFormState();
  const failure = failureOf(questionId);
  const provenance = provenanceOf(state, questionId);
  if (failure === undefined && provenance === undefined) return null;

  return (
    <Stack gap={2} align="flex-start">
      {failure !== undefined && (
        <Text size="xs" c="yellow.9">
          {failure}
        </Text>
      )}
      {provenance !== undefined && <ProvenanceButton provenance={provenance} />}
    </Stack>
  );
}

function ProvenanceButton({ provenance }: { provenance: Provenance }) {
  return (
    <Popover width={360} position="bottom-start" withArrow shadow="md">
      <Popover.Target>
        <Button variant="subtle" size="compact-xs" px={0}>
          How is this computed?
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm">{provenance.method}</Text>
          {provenance.rubriques.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                DSN fields read
              </Text>
              <Group gap={4}>
                {provenance.rubriques.map((rubrique) => (
                  <Code key={rubrique}>{rubrique}</Code>
                ))}
              </Group>
            </Stack>
          )}
          {provenance.notes.length > 0 && (
            <List size="xs" spacing={4}>
              {provenance.notes.map((note) => (
                <List.Item key={note}>{note}</List.Item>
              ))}
            </List>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
