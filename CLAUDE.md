# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Lead Developer case study for Kiosk (ESG/CSRD reporting). Build steps 1 (setup), 2 (`dsn` parser), 3 (`questionnaire`: question tree + mapping engine), 4 (upload flow: upload, import status, streamed answers) and 5 (form: recursive rendering, tables, locked and waiting states, editing, saving) of `implementation-plan.md` §9 are done. `docx-export` is an empty skeleton. Inputs and plan:

- `project-scope.md`: the brief from Kiosk. The deliverable README must cover how to run the project, how AI was used, and what to improve next.
- `implementation-plan.md`: the agreed plan. It is the source of truth for architecture and scope decisions. Read it before starting any work, and keep it lean and code‑free when updating it.
- `dsn.txt`: sample DSN file. It defines the v1 scope.
- `questions.csv`: the S1‑6 questions to answer.
- `dsn-cahier-technique-2024.1.pdf`: official DSN specification (375 pages). The Read tool cannot render it (no poppler). Extract the text with `pypdf` into the scratchpad and search it by rubrique code (e.g. `S21.G00.40.007`).

## Commands

Node 24, pnpm 11. Run from the repo root unless noted. A single `.env` at the root (copy `.env.example`) is loaded by `dotenv-cli` in the `db` and `web` scripts.

- First run: `pnpm install && pnpm bootstrap` (starts Postgres in Docker, applies migrations, seeds questions from `questions.csv`). Don't name a script `setup`: `pnpm setup` is a built‑in pnpm command and shadows it.
- Dev server: `pnpm dev` (Next.js on http://localhost:3000)
- All checks (what CI runs): `pnpm check` (lint, typecheck, then test in every package via `pnpm -r`), plus `pnpm format:check` and `pnpm build`
- One package: `pnpm --filter @kiosk/dsn test` (same for `lint`, `typecheck`)
- Single test: `pnpm --filter @kiosk/db exec vitest run src/seed/parse-questions-csv.test.ts -t "normalises"`
- New migration after editing `packages/db/src/schema.ts`: `pnpm db:generate --name <name>`, then `pnpm db:migrate`. Migrations are SQL files in `packages/db/drizzle/`.
- Apply migrations / reseed / reset / browse: `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:reset`, `pnpm db:studio`

Notes:

- Drizzle uses the `pg` driver and `casing: 'snake_case'` (camelCase in TypeScript, snake_case in SQL), set in both `client.ts` and `drizzle.config.ts`. `getDb()` creates the pool on first use, so importing `@kiosk/db` never needs a database (`next build` runs without one).
- `@kiosk/db` re‑exports the Drizzle query helpers it needs (`eq`, `count`, …); import them from there, not from `drizzle-orm`. Add to that list when a new helper is needed.
- Upload and processing: `server/upload-dsn.ts` (server action: quick check with `looksLikeDsn`, store, redirect) and `processImport` in `server/imports.ts` (the one processing entry point: idempotent, row‑locked, 30 s timeout, never rejects). `/imports/[id]` passes its promise unawaited to a client component that reads it with `use()` inside `Suspense`.
- Form: `src/form-state.ts` is a pure reducer (current values, last saved values, computed values per cell). Two contexts: `FormStateContext` (changes on every keystroke) and `AnswerFormContext` (dispatch and pre‑fill state, stable while editing); `AnswerInput` is memoised and gets its cell through `cellState`, so an edit re-renders one input. `src/answer-grid.ts` holds the rules both the form and the `saveAnswers` action use (table columns, derived answers, number parsing), so they always agree. The action sends only changed cells; `server/answer-changes.ts` (pure, tested) validates them and recomputes derived answers, and `storeAnswers` (`server/store-answers.ts`) upserts them under a row lock on the import. The save button catches a failed request, so it never reaches the error boundary and resets the form.
- Pages that read the database call `await connection()` (from `next/server`) so Next doesn't prerender them at build time. Database access lives in `apps/web/src/server/` behind `import 'server-only'`.
- ESLint enforces the layering: domain packages use `@kiosk/eslint-config/domain`, which forbids importing `@kiosk/db`, `@kiosk/web`, `drizzle-orm` or `pg`. The web app uses `@kiosk/eslint-config/next` (Next's Core Web Vitals preset on top of the base rules).
- Workspace packages are compiled by Next through `transpilePackages` in `apps/web/next.config.ts`; add new packages there.
- pnpm 11 needs build scripts approved under `allowBuilds` in `pnpm-workspace.yaml`. Packages newer than pnpm's minimum release age go under `minimumReleaseAgeExclude`.

## Planned architecture

pnpm workspaces (no Turborepo: with five small packages its caching and task graph weren't worth an extra tool). Shared packages export their TypeScript source directly ("Just‑in‑Time" packages, no build step).

- `apps/web`: Next.js 16 (App Router, `src/app`) + Mantine 8. Pages stay thin.
- `packages/dsn`: DSN parser. Pure TypeScript, no dependencies.
- `packages/questionnaire`: question tree + mapping engine. Registries: `RESOLVERS` (one per question), `TABLE_BREAKDOWNS` (dimensions per table) and `DERIVED_ANSWERS` (answers computed from other answers, shared with the form). DSN code meanings live only in `code-lists.ts`. `mapDsn` never throws: failing questions become `failures`. Depends on `dsn`.
- `packages/docx-export`: builds the `.docx` with the `docx` library. Depends on `questionnaire`.
- `packages/db`: Drizzle + PostgreSQL schema, migrations, question seed, shared client.

Domain packages (`dsn`, `questionnaire`, `docx-export`) must never import `db` or `web`.

All code must follow the SOLID design requirements in `implementation-plan.md` §6: registries over engine edits, one definition per business rule, minimal public exports, no dead code or silencing casts.

**Agreed user flow:** the DSN upload is mandatory. After upload, the form renders immediately. Questions the mapping can answer are locked with a "waiting for pre‑filled answers" indicator until the answers stream in; the other questions are editable at once. Each answer keeps both `computedValue` and the user's `value` (per table cell), so edits can be marked and reset.

**Scope:** v1 targets the shape of the provided `dsn.txt`. Larger and more complete DSNs are listed as next steps; keep the code extensible for them, but don't build for them now.

## Domain notes that aren't obvious from the files

- **DSN line format:** `S21.G00.30.001,'value'`. The first 10 characters are the block code (`S21.G00.30`). The file also contains block header lines with an empty value (`S21.G00.30,''`); use them to detect where a block starts. Hierarchy: `S21.G00.06` company → `.11` establishment → `.30` employee → `.40` contract / `.50` payment → `.51` pay period; `.62` is contract end.
- **`dsn.txt` is generated test data:** 1 company, 1 establishment, 100 employees, each with exactly one `.40`, `.50` and `.51` block, and no `.62` blocks. Many values are meaningless (contract type `40.007`, status `40.002`/`40.003`, declared month `S20.G00.05.005` = `19460720`). The parser keeps codes as raw values and never crashes on them. v1 only uses what `dsn.txt` and `questions.csv` define: the parser applies no rules from the official spec, and code lists belong to `questionnaire` (`code-lists.ts`). Only sex (`30.005`: 52 × `01` male, 48 × `02` female) and the payment dates `50.001` (Nov–Dec 2025) are reliable, so the reporting period comes from the payment dates (pay periods `.51` run into January 2026).
- **`questions.csv`:**
  - `;`‑separated, with many empty trailing columns; the header uses `relatedQuestion ID`.
  - `content` mixes casing (`Table`/`Text`), so normalise it.
  - Enum options are separated by `", "`, not `;` as the brief says.
  - Nesting is defined by `relatedQuestion ID` + `order`.
  - A `table` question's children are its **rows**. Its **columns** are the breakdown values implied by the table title (country, contract × gender, region, category), computed from the data.
- **Reference parser:** La Société Nouvelle's `DSNReader.js`, linked in the brief. Don't copy its approach. It never records errors, overwrites earlier establishments, merges consecutive blocks of the same type, and crashes when blocks arrive in an unexpected order.
