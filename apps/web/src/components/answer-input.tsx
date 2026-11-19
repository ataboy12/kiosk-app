'use client';

import type { AnswerValue, QuestionNode } from '@kiosk/questionnaire';
import {
  ActionIcon,
  Loader,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { memo, type CSSProperties } from 'react';
import { DERIVED_QUESTION_IDS, MAX_TEXT_LENGTH, readNumber } from '~/answer-grid';
import type { ComputedCell } from '~/form-state';
import { useAnswerForm } from './answer-form-context';

interface AnswerInputProps {
  question: QuestionNode;
  columnKey: string;
  label: string;
  /** In a table the row and column headers show the label, so it is only read out. */
  inTable?: boolean;
  /** The cell's value and, when the user changed it, the DSN's (from `cellState`). */
  value: AnswerValue;
  edited: ComputedCell | undefined;
}

/**
 * The input of one answer cell: locked while waiting for the DSN, then editable and resettable.
 * Memoised: it re-renders only when its own cell changes.
 */
export const AnswerInput = memo(function AnswerInput({
  question,
  columnKey,
  label,
  inTable = false,
  value,
  edited: editedCell,
}: AnswerInputProps) {
  const { dispatch, isLocked } = useAnswerForm();
  const labels = inTable ? { 'aria-label': label } : { label };
  if (isLocked(question.id)) return <WaitingInput {...labels} />;

  const questionId = question.id;
  const derived = DERIVED_QUESTION_IDS.has(questionId);
  // Derived answers follow their inputs: the user edits those, so they are never "edited".
  const edited = derived ? undefined : editedCell;
  const set = (next: AnswerValue) =>
    dispatch({ type: 'edited', questionId, columnKey, value: next === '' ? null : next });

  // Mantine lets clicks pass through the right section by default; the reset button needs them.
  const rightSectionPointerEvents: CSSProperties['pointerEvents'] = edited ? 'all' : 'none';
  const shared = {
    ...labels,
    readOnly: derived,
    variant: derived ? 'filled' : 'default',
    description:
      edited && !inTable ? `Edited. Computed from your DSN: ${preview(edited.value)}` : undefined,
    rightSection: edited ? (
      <ResetButton
        label={label}
        computed={edited.value}
        onReset={() => dispatch({ type: 'reset', questionId, columnKey })}
      />
    ) : undefined,
    rightSectionPointerEvents,
    styles: edited ? { input: { borderColor: 'var(--kiosk-edited)' } } : undefined,
  };

  switch (question.content) {
    case 'NUMBER':
      return (
        <NumberInput
          {...shared}
          value={value ?? ''}
          onChange={set}
          // A partly typed number ("1.") is kept as text while typing, then read on leaving.
          onBlur={() => typeof value === 'string' && set(readNumber(value) ?? null)}
          hideControls
        />
      );
    case 'ENUM':
      return (
        <Select
          {...shared}
          data={question.enumEn}
          value={typeof value === 'string' ? value : null}
          onChange={set}
          clearable={!edited && !derived}
        />
      );
    default: // TEXT: tables and the form only render number, enum and text answers.
      return (
        <Textarea
          {...shared}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => set(event.currentTarget.value)}
          maxLength={MAX_TEXT_LENGTH}
          autosize
          minRows={inTable ? 1 : 3}
          maxRows={12}
        />
      );
  }
});

/**
 * A field the DSN will fill. Read-only rather than disabled, so screen readers still reach it and
 * its tooltip.
 */
export function WaitingInput(labels: { label: string } | { 'aria-label': string }) {
  return (
    <Tooltip
      label="Pre-filled from your DSN: this field unlocks as soon as its answer is computed."
      events={{ hover: true, focus: true, touch: true }}
      multiline
      w={260}
    >
      <TextInput
        {...labels}
        value=""
        placeholder="Waiting…"
        readOnly
        aria-busy
        rightSection={<Loader size={14} />}
      />
    </Tooltip>
  );
}

interface ResetButtonProps {
  label: string;
  computed: AnswerValue;
  onReset: () => void;
}

function ResetButton({ label, computed, onReset }: ResetButtonProps) {
  return (
    <Tooltip label={`Edited. Reset to the value computed from your DSN: ${preview(computed)}`}>
      <ActionIcon
        variant="subtle"
        color="amber"
        size="sm"
        aria-label={`${label}: edited. Reset to the computed value, ${preview(computed)}`}
        onClick={onReset}
      >
        ↺
      </ActionIcon>
    </Tooltip>
  );
}

/** A value short enough for a tooltip. */
function preview(value: AnswerValue): string {
  if (value === null) return 'empty';
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
