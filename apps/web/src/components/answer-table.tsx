'use client';

import type { QuestionNode } from '@kiosk/questionnaire';
import {
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  VisuallyHidden,
  type TitleOrder,
} from '@mantine/core';
import { cellState } from '~/form-state';
import { useAnswerForm, useFormState } from './answer-form-context';
import { AnswerInput, WaitingInput } from './answer-input';
import { QuestionNotes } from './question-notes';
import { labelOf } from './question-label';

const ROW_HEADER_WIDTH = 240;
const COLUMN_WIDTH = 140;

/**
 * A table question: its child questions are the rows, the breakdown values found in the DSN are
 * the columns. Until they are computed, one placeholder column holds the waiting fields.
 */
export function AnswerTable({ table, order }: { table: QuestionNode; order: TitleOrder }) {
  const { columnsOf } = useAnswerForm();
  const state = useFormState();
  const columns = columnsOf(table.id);
  const titleId = `${table.id}-title`;

  return (
    <Stack gap="sm">
      <Title order={order} size="h4" id={titleId}>
        {table.labelEn}
      </Title>
      <Table.ScrollContainer minWidth={ROW_HEADER_WIDTH + (columns?.length ?? 1) * COLUMN_WIDTH}>
        <Table aria-labelledby={titleId} withTableBorder withColumnBorders verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={ROW_HEADER_WIDTH}>Question</Table.Th>
              {columns ? (
                columns.map((column) => <Table.Th key={column.key}>{column.label}</Table.Th>)
              ) : (
                <Table.Th>
                  <Skeleton height={12} width={96} />
                  <VisuallyHidden>Columns are being computed from your DSN</VisuallyHidden>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {table.children.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Th scope="row" fw="normal">
                  <Stack gap={4}>
                    <Text size="sm">{labelOf(row)}</Text>
                    <QuestionNotes questionId={row.id} />
                  </Stack>
                </Table.Th>
                {columns ? (
                  columns.map((column) => (
                    <Table.Td key={column.key}>
                      <AnswerInput
                        question={row}
                        columnKey={column.key}
                        label={`${labelOf(row)}, ${column.label}`}
                        inTable
                        {...cellState(state, row.id, column.key)}
                      />
                    </Table.Td>
                  ))
                ) : (
                  // Without columns no row can be answered yet, mapped or not.
                  <Table.Td>
                    <WaitingInput aria-label={labelOf(row)} />
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
