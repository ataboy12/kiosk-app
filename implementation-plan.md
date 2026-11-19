# Kiosk DSN case study: implementation plan

## 1. Goal

Upload a DSN, parse it on the server, map its data to the S1‑6 workforce questions, show the answers in one editable form, and export it to Word. The brief values architecture, readable code, UX and explained trade‑offs over completeness.

## 2. Input constraints

- **`dsn.txt` defines the v1 scope.** It has 1 company, 1 establishment and 100 employees, each with one contract and one pay period, no contract ends, and many invalid codes. Only sex and the payment dates are reliable.
- **Extensibility:** larger and more complete DSNs (several establishments, several contracts per employee, contract ends and changes, big files) are not handled in v1. The code is structured so they can be added without a rewrite (see §3 and §10).
- **`questions.csv` is irregular.** It uses `;` as separator, mixes casing in `content`, and separates enum options with `", "`. Table questions are 2‑D: the child questions are the rows, and the breakdown values (country, contract × gender, …) are the columns.
- **Reporting period:** read from `S20.G00.05.005` when it is a valid date, otherwise derived from the payment dates (the case in the sample).

## 3. Parsing

- A declarative parent/child table describes the block hierarchy, with a stack that tracks the latest instance of each block type. Supporting a new block type means adding an entry to this table, not new parsing logic.
- A new block starts on a block header line, or when the block code changes or the rubrique number stops increasing.
- Values are converted to proper types (dates, decimals).
- **Tolerant to bad values:** unexpected values become warnings with line numbers, never crashes. The import fails only when the file isn't a DSN or contains no employees. The mapping sends unknown codes to "Other / Unknown".
- This fixes the limits of the La Société Nouvelle parser: errors never recorded, establishments overwritten, consecutive blocks merged, crashes on unexpected block order, values left as strings.

## 4. Mapping

| Question                           | Source / method                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| S1‑6_02 Employees at end of period | Employees with a contract active at the period end                                                                      |
| S1‑6_03 Average during period      | Average of headcount at period start and end (single DSN, documented simplification)                                    |
| S1‑6_11 Leavers                    | `S21.G00.62` blocks with an end date in the period, excluding reason `099` (cancellation). 0 on the sample, with a note |
| S1‑6_12 Turnover %                 | Leavers ÷ average headcount × 100, recalculated when either input is edited                                             |
| S1‑6_05/06 By country              | Establishment country `11.015` (empty means France)                                                                     |
| K_718/719 Contract × gender        | `40.007` grouped into permanent / temporary / non‑guaranteed hours / other, crossed with `30.005`                       |
| S1‑6_09/10 By region               | Establishment postal code → région, otherwise "Unknown"                                                                 |
| S1‑6_19/20 By category             | First digit of `40.004` (occupation category), `40.003` (status) as fallback                                            |
| S1‑6_14 / S1‑6_15                  | Pre‑filled with "Head‑count" / "At end of period", editable                                                             |
| S1‑6_16 Context                    | Pre‑filled with generated text (company, period, data‑quality warnings)                                                 |
| S1‑6_17                            | Manual only                                                                                                             |

- Every computed answer stores its **provenance** (rubriques used, method), which the UI shows to the user.
- Each question has its own resolver in a registry, so adding or changing a mapping touches one resolver only.
- Employees are counted by unique identifier, and breakdown columns come from the values found in the data. Both cost nothing on the sample and keep the mapping correct for richer files.

## 5. Stack

- **pnpm workspaces.** The package boundaries enforce the layering, and each package is tested on its own. Turborepo was dropped: with five small packages, its caching and task ordering saved too little to justify another tool, and plain `pnpm -r` scripts are enough. The shared packages export their TypeScript source directly, so they need no build step.
- **Next.js 16 (App Router)**, **Mantine 8**, **Drizzle ORM + PostgreSQL** (Docker), **`docx`** for the Word export, **Zod** for validation, **Vitest** for tests.
- **Next.js:** server components read the data, server actions handle upload and save, and a promise passed to a client component inside `Suspense` streams the pre‑filled answers into the already rendered form.
- **Drizzle:** the schema is plain TypeScript, so there is no generate step or engine binary, and typed `jsonb` columns fit warnings, values and provenance. Migrations are SQL files generated by `drizzle-kit`.

## 6. Repository layout

| Package                                                | Role                                                        | Depends on         |
| ------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| `apps/web`                                             | Next.js pages, server actions and form UI                   | all packages below |
| `packages/dsn`                                         | DSN parser and code lists                                   | nothing            |
| `packages/questionnaire`                               | Question tree and mapping engine                            | `dsn`              |
| `packages/docx-export`                                 | Builds the Word file                                        | `questionnaire`    |
| `packages/db`                                          | Drizzle schema, migrations, seed (questions), shared client | nothing            |
| `packages/typescript-config`, `packages/eslint-config` | Shared configuration                                        | nothing            |

The domain packages (`dsn`, `questionnaire`, `docx-export`) never import `db` or `web`.

**Data model:**

- `DsnImport`: status (`PROCESSING` / `READY` / `FAILED`), company, period, warnings.
- `Question`: seeded from the CSV.
- `Answer`: `computedValue`, `value`, `source` (`COMPUTED` / `MANUAL`) and provenance, all tracked per table cell.

## 7. User flow

1. **Upload (required).** The user can't go further without a file. The server does a quick check, stores the file, creates the import as `PROCESSING`, and redirects immediately.
2. **Form shown at once.** All questions render immediately.
   - Questions the DSN can answer (known in advance from the mapping) are **locked**, with a "waiting for pre‑filled answers" indicator.
   - All other questions are editable straight away.
   - Answers are **streamed** to the page. Processing is safe to repeat: if the import is already `READY`, the saved answers are read instead of recomputed.
   - Processing sits behind one function, so it can later move to a background job without changing the UI.
3. **Answers arrive.** The locked fields unlock with their values, and a summary replaces the waiting banner (employees found, questions pre‑filled, warnings). Anything typed in the meantime is kept.
4. **Edit.** Pre‑filled values can be edited (marked "edited", with a "reset to computed" action). Turnover recalculates when its inputs change.
5. **Save and export.** Save is explicit and keeps the user on the page. Export is disabled until pre‑filling has finished.

## 8. UX principles

- **Feedback at every step.** Say what the system is doing in plain words ("Reading your DSN…"), keep the layout stable, and never show a blank page.
- **Locked fields:** a waiting indicator inside the field, a tooltip explaining why, and table columns shown as placeholders until the data arrives. They use a read‑only state rather than `disabled`, so screen readers can still reach them, and the arrival of answers is announced.
- **Warnings and errors in business language**, each with a next step ("Upload another file", "Retry"). User input is never lost.
- **Failure handling:**
  - Fatal parsing error: show the message and offer a new upload.
  - A single question that can't be computed: unlock it empty, with an explanation.
  - Processing that runs too long: time out and offer a retry.

## 9. Build order

1. **Setup:** monorepo, shared configs, Next.js + Mantine app, Drizzle + Postgres, question seed, CI (lint, typecheck, test).
2. **`dsn`:** parser and tests (small edge‑case fixtures, plus a check on the sample: 100 employees, 52 male / 48 female).
3. **`questionnaire`:** question tree, then mapping engine with provenance, both tested.
4. **Upload flow:** required upload, import status, streamed answers.
5. **Form:** recursive rendering, tables, locked and waiting states, editing, saving.
6. **`docx-export`:** title, sections as headings, questions as label: value lines, tables as Word tables.
7. **README:** setup, architecture and trade‑offs, mapping rationale, AI usage, next steps.

## 10. Next steps

- **Larger and more complete DSNs:**
  - several establishments, several contracts per employee, contract ends and changes (`S21.G00.41`);
  - large files: stream the upload to storage, parse line by line, group warnings by type;
  - background job with a queue (for example pg-boss on the existing Postgres), with the page following the import status;
  - wide tables with horizontal scroll and an upload progress bar.
- Several DSNs per year, for true averages and annual leavers.
- Full‑time‑equivalent mode.
- User‑configurable mapping rules.
- French/English labels, autosave, edit history.
- Authentication, Playwright end‑to‑end tests.
