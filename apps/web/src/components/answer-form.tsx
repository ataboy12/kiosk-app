'use client';

import { labelOf, SCALAR_COLUMN, type QuestionNode } from '@kiosk/questionnaire';
import { Stack, Title, type TitleOrder } from '@mantine/core';
import { answerStatus, cellState } from '~/form-state';
import { Annotated } from './annotated';
import { useAnswerForm, useFormState } from './answer-form-context';
import { AnswerInput } from './answer-input';
import { AnswerTable } from './answer-table';
import { QuestionNotes } from './question-notes';
import classes from './working-paper.module.css';

/** Heading levels by depth: the page title is the h1, top-level questions are h2. */
const HEADING_ORDERS: readonly TitleOrder[] = [2, 3, 4, 5, 6];

/** The questionnaire: one section per top-level question, nested questions rendered recursively. */
export function AnswerForm({ questions }: { questions: readonly QuestionNode[] }) {
  return (
    <div>
      {questions.map((question) => (
        <section key={question.id} className={classes.section}>
          <QuestionView question={question} depth={0} />
        </section>
      ))}
    </div>
  );
}

function QuestionView({ question, depth }: { question: QuestionNode; depth: number }) {
  const order = HEADING_ORDERS[Math.min(depth, HEADING_ORDERS.length - 1)] ?? 6;
  switch (question.content) {
    case 'GROUP':
      return (
        <Stack gap="lg">
          <Title order={order} size="h3">
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

/** A question outside tables: one input, its status bar and its margin note. */
function ScalarQuestion({ question }: { question: QuestionNode }) {
  const { isLocked } = useAnswerForm();
  const state = useFormState();
  return (
    <Annotated
      status={isLocked(question.id) ? 'waiting' : answerStatus(state, question.id)}
      margin={<QuestionNotes questionId={question.id} />}
    >
      <AnswerInput
        question={question}
        columnKey={SCALAR_COLUMN.key}
        label={labelOf(question)}
        {...cellState(state, question.id, SCALAR_COLUMN.key)}
      />
    </Annotated>
  );
}
