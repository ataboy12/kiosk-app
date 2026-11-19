'use client';

import { labelOf, type QuestionNode } from '@kiosk/questionnaire';
import { Skeleton, Stack, Table, Title, VisuallyHidden, type TitleOrder } from '@mantine/core';
import { answerStatus, cellState } from '~/form-state';
import { Annotated, StatusText } from './annotated';
import { useAnswerForm, useFormState } from './answer-form-context';
import { AnswerInput, WaitingInput } from './answer-input';
import { QuestionNotes, SharedNotes } from './question-notes';
import classes from './working-paper.module.css';

const ROW_HEADER_WIDTH = 200;
const COLUMN_WIDTH = 104;

/**
 * A table question: its child questions are the rows, the breakdown values found in the DSN are
 * the columns. Until they are computed, one placeholder column holds the waiting fields. Each row
 * header carries the row's status bar; the margin explains every row and gives the data-quality
 * notes once.
 */
export function AnswerTable({ table, order }: { table: QuestionNode; order: TitleOrder }) {
  const { columnsOf, isLocked } = useAnswerForm();
  const state = useFormState();
  const columns = columnsOf(table.id);
  const titleId = `${table.id}-title`;

  return (
    <Stack gap="md">
      <Title order={order} size="h3" id={titleId}>
        {table.labelEn}
      </Title>
      <Annotated
        margin={
          <Stack gap="md">
            {table.children.map((row) => (
              <QuestionNotes key={row.id} questionId={row.id} label={labelOf(row)} withoutNotes />
            ))}
            <SharedNotes questionIds={table.children.map((row) => row.id)} />
          </Stack>
        }
      >
        <Table.ScrollContainer minWidth={ROW_HEADER_WIDTH + (columns?.length ?? 1) * COLUMN_WIDTH}>
          <Table aria-labelledby={titleId} withTableBorder withColumnBorders verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={ROW_HEADER_WIDTH}>
                  <VisuallyHidden>Question</VisuallyHidden>
                </Table.Th>
                {columns ? (
                  columns.map((column) => (
                    <Table.Th key={column.key} fw={500}>
                      {column.label}
                    </Table.Th>
                  ))
                ) : (
                  <Table.Th>
                    <Skeleton height={12} width={96} />
                    <VisuallyHidden>Columns are being computed from your DSN</VisuallyHidden>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {table.children.map((row) => {
                const status = isLocked(row.id) ? 'waiting' : answerStatus(state, row.id);
                return (
                  <Table.Tr key={row.id}>
                    <Table.Th
                      scope="row"
                      fw="normal"
                      className={classes.rowHeader}
                      data-status={status}
                    >
                      {labelOf(row)}
                      <StatusText status={status} />
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
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Annotated>
    </Stack>
  );
}
