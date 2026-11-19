'use client';

import { SCALAR_COLUMN, type QuestionNode } from '@kiosk/questionnaire';
import { Paper, Stack, Title, type TitleOrder } from '@mantine/core';
import { cellState } from '~/form-state';
import { useFormState } from './answer-form-context';
import { AnswerInput } from './answer-input';
import { AnswerTable } from './answer-table';
import { labelOf } from './question-label';
import { QuestionNotes } from './question-notes';

/** Heading levels by depth: the page title is the h1, top-level questions are h2. */
const HEADING_ORDERS: readonly TitleOrder[] = [2, 3, 4, 5, 6];

/** The questionnaire: one card per top-level question, nested questions rendered recursively. */
export function AnswerForm({ questions }: { questions: readonly QuestionNode[] }) {
  return (
    <Stack gap="md">
      {questions.map((question) => (
        <Paper key={question.id} withBorder p="md">
          <QuestionView question={question} depth={0} />
        </Paper>
      ))}
    </Stack>
  );
}

function QuestionView({ question, depth }: { question: QuestionNode; depth: number }) {
  const order = HEADING_ORDERS[Math.min(depth, HEADING_ORDERS.length - 1)] ?? 6;
  switch (question.content) {
    case 'GROUP':
      return (
        <Stack gap="md">
          <Title order={order} size="h4">
            {question.labelEn}
          </Title>
          {question.children.map((child) => (
            <QuestionView key={child.id} question={child} depth={depth + 1} />
          ))}
        </Stack>
      );
    case 'TABLE':
      return <AnswerTable table={question} order={order} />;
    default:
      return <ScalarQuestion question={question} />;
  }
}

/** A question outside tables: one input. */
function ScalarQuestion({ question }: { question: QuestionNode }) {
  const state = useFormState();
  return (
    <Stack gap={4}>
      <AnswerInput
        question={question}
        columnKey={SCALAR_COLUMN.key}
        label={labelOf(question)}
        {...cellState(state, question.id, SCALAR_COLUMN.key)}
      />
      <QuestionNotes questionId={question.id} />
    </Stack>
  );
}
