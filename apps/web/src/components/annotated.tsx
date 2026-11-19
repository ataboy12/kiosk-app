import { VisuallyHidden } from '@mantine/core';
import type { ReactNode } from 'react';
import type { AnswerStatus } from '~/form-state';
import classes from './working-paper.module.css';

/** An answer's status, or `waiting` while the DSN is read. */
export type RowStatus = AnswerStatus | 'waiting';

/** What each status bar means: the legend shows them, screen readers read them out. */
const STATUS_LABELS: Record<AnswerStatus, string> = {
  computed: 'From your DSN',
  yours: 'Changed or added by you',
  missing: 'To complete',
};

const LEGEND_ORDER: readonly AnswerStatus[] = ['computed', 'yours', 'missing'];

interface AnnotatedProps {
  /** Draws the status bar on the left; tables leave it out and mark each row instead. */
  status?: RowStatus;
  /** How the answer was computed, written in the right margin. */
  margin: ReactNode;
  children: ReactNode;
}

/** An answer with its status bar on the left and its source in the margin on the right. */
export function Annotated({ status, margin, children }: AnnotatedProps) {
  return (
    <div className={classes.annotated}>
      <div className={classes.main} data-status={status}>
        {status && <StatusText status={status} />}
        {children}
      </div>
      <div className={classes.margin}>{margin}</div>
    </div>
  );
}

/** The status bar in words, for screen readers. */
export function StatusText({ status }: { status: RowStatus }) {
  // A waiting field says so itself.
  return status === 'waiting' ? null : <VisuallyHidden>{STATUS_LABELS[status]}</VisuallyHidden>;
}

/** Explains the status bars, above the form. */
export function StatusLegend() {
  return (
    <ul className={classes.legend} aria-label="What the bars beside the answers mean">
      {LEGEND_ORDER.map((status) => (
        <li key={status}>
          <span className={classes.swatch} data-status={status} aria-hidden />
          {STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}
