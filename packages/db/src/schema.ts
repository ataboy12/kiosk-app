import { relations } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Columns are camelCase here and snake_case in Postgres (`casing: 'snake_case'` in the client
// and in drizzle.config.ts).

export const importStatus = pgEnum('import_status', ['PROCESSING', 'READY', 'FAILED']);

/** Normalised from the `content` column of questions.csv. GROUP is the empty value: a title with children. */
export const questionContent = pgEnum('question_content', [
  'GROUP',
  'NUMBER',
  'TEXT',
  'ENUM',
  'TABLE',
]);

export const answerSource = pgEnum('answer_source', ['COMPUTED', 'MANUAL']);

/** A parser warning, stored as JSON on the import. */
export interface ImportWarning {
  line: number;
  code: string;
  message: string;
}

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** One uploaded DSN file and the result of processing it. */
export const dsnImports = pgTable('dsn_import', {
  id: uuid().primaryKey().defaultRandom(),
  fileName: text().notNull(),
  /** Raw file content. Fine for v1 (the sample is ~300 KB); move to object storage for large files. */
  content: text().notNull(),
  status: importStatus().notNull().default('PROCESSING'),
  companyName: text(),
  siren: text(),
  periodStart: date({ mode: 'string' }),
  periodEnd: date({ mode: 'string' }),
  warnings: jsonb().$type<ImportWarning[]>().notNull().default([]),
  /** Business-language message when status is FAILED. */
  error: text(),
  ...timestamps,
});

/** Seeded from questions.csv. Nesting comes from `parentId` + `order`. */
export const questions = pgTable(
  'question',
  {
    id: text().primaryKey(),
    labelEn: text().notNull(),
    labelFr: text().notNull(),
    content: questionContent().notNull(),
    parentId: text().references((): AnyPgColumn => questions.id, { onDelete: 'set null' }),
    order: integer().notNull(),
    unit: text(),
    enumEn: text().array().notNull().default([]),
    enumFr: text().array().notNull().default([]),
  },
  (t) => [index().on(t.parentId)],
);

/** One value per question, or per table cell (`columnKey` is the breakdown key, "" outside tables). */
export const answers = pgTable(
  'answer',
  {
    id: uuid().primaryKey().defaultRandom(),
    importId: uuid()
      .notNull()
      .references(() => dsnImports.id, { onDelete: 'cascade' }),
    questionId: text()
      .notNull()
      .references(() => questions.id),
    columnKey: text().notNull().default(''),
    /** Value derived from the DSN, kept so an edited value can be reset. */
    computedValue: jsonb(),
    /** Current value shown to the user (computed or edited). */
    value: jsonb(),
    source: answerSource().notNull(),
    /** How the computed value was obtained: rubriques used, method, notes. */
    provenance: jsonb(),
    ...timestamps,
  },
  (t) => [unique().on(t.importId, t.questionId, t.columnKey)],
);

export const dsnImportsRelations = relations(dsnImports, ({ many }) => ({
  answers: many(answers),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  parent: one(questions, {
    fields: [questions.parentId],
    references: [questions.id],
    relationName: 'question_tree',
  }),
  children: many(questions, { relationName: 'question_tree' }),
  answers: many(answers),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  import: one(dsnImports, { fields: [answers.importId], references: [dsnImports.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));

export type DsnImport = typeof dsnImports.$inferSelect;
export type NewDsnImport = typeof dsnImports.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Answer = typeof answers.$inferSelect;
export type NewAnswer = typeof answers.$inferInsert;
export type ImportStatus = (typeof importStatus.enumValues)[number];
export type QuestionContent = (typeof questionContent.enumValues)[number];
export type AnswerSource = (typeof answerSource.enumValues)[number];
