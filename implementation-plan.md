# Kiosk DSN case study: implementation plan

## 1. Goal

Upload a DSN, parse it on the server, map its data to the S1‑6 workforce questions, show the answers in one editable form, and export it to Word. The brief values architecture, readable code, UX and explained trade‑offs over completeness.

## 2. Input constraints

- **`dsn.txt` defines the v1 scope.** It has 1 company, 1 establishment and 100 employees, each with one contract and one pay period, no contract ends, and many invalid codes. Only sex and the payment dates are reliable.
- **Extensibility:** larger and more complete DSNs (several establishments, several contracts per employee, contract ends and changes, big files) are not handled in v1. The code is structured so they can be added without a rewrite (see §3 and §10).
- **`questions.csv` is irregular.** It uses `;` as separator, mixes casing in `content`, and separates enum options with `", "`. Table questions are 2‑D: the child questions are the rows, and the breakdown values (country, contract × gender, …) are the columns.
- **Reporting period:** the declared month `S20.G00.05.005` when payment dates `50.001` fall in it, otherwise the whole months spanned by the payment dates (the case in the sample, where it is 1946‑07‑20, giving Nov–Dec 2025). Pay periods `.51` are not used: in the sample they run into January 2026.

## 3. Parsing

- A declarative parent/child table describes the block hierarchy, with a stack that tracks the latest instance of each block type. Supporting a new block type means adding an entry to this table, not new parsing logic.
- A new block starts on a block header line, or when the block code changes or the rubrique number stops increasing.
- Two stages: lines become a block tree, then a declarative field spec per block reads the needed rubriques into a typed, JSON‑safe model (ISO dates). Each entity keeps its line number for provenance. Repeated blocks are kept as lists, so nothing is overwritten. File decoding is left to the caller.
- **v1 uses only what the provided files define.** The parser keeps every code as a raw value without validation and applies no rules from the official spec; interpreting codes (e.g. sex `01`/`02`) is the mapping's job. The company is a top‑level block, and the `S10` header blocks are skipped.
- **Tolerant to bad values:** unreadable values (malformed lines, impossible dates, missing identifiers) become warnings with line numbers, never crashes; impossible dates become empty. Unsupported block types produce one warning per type. The import fails only when the file isn't a DSN or contains no employees. The mapping sends unknown codes to "Other / Unknown".
- This fixes the limits of the La Société Nouvelle parser: errors never recorded, establishments overwritten, consecutive blocks merged, crashes on unexpected block order, values left as strings.

## 4. Mapping

| Question                           | Source / method                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| S1‑6_02 Employees at end of period | Employees with a contract active at the period end                                                                      |
| S1‑6_03 Average during period      | Average of headcount at period start and end (single DSN, documented simplification)                                    |
| S1‑6_11 Leavers                    | `S21.G00.62` blocks with an end date in the period, excluding reason `099` (cancellation). 0 on the sample, with a note |
| S1‑6_12 Turnover %                 | Leavers ÷ average headcount × 100, recalculated when either input is edited                                             |
| S1‑6_05/06 By country              | Establishment country `11.015` (empty means France)                                                                     |
| K_718/719 Contract × gender        | `40.007` grouped into permanent / temporary / non‑guaranteed hours (`07`) / other, crossed with `30.005`                |
| S1‑6_09/10 By region               | Establishment postal code → région; "Outside France" when `11.015` is set (the sample's `IR`), otherwise "Unknown"      |
| S1‑6_19/20 By category             | First digit of `40.004` (PCS‑ESE group 1–6), `40.003` (pension status: cadre / non‑cadre) as fallback                   |
| S1‑6_14 / S1‑6_15                  | Pre‑filled with "Head‑count" / "At end of period", editable                                                             |
| S1‑6_16 Context                    | Pre‑filled with generated text (company, period, data‑quality warnings)                                                 |
| S1‑6_17                            | Manual only                                                                                                             |

- Every computed answer stores its **provenance** (rubriques used, method), which the UI shows to the user.
- Each question has its own resolver in a registry, so adding or changing a mapping touches one resolver only.
- Employees are counted by unique identifier, and breakdown columns come from the values found in the data. Both cost nothing on the sample and keep the mapping correct for richer files.
- Breakdowns are combinations of reusable dimensions (gender, contract type, country, région, category). Each dimension knows its rubriques and which values are unknown, which feeds both the table columns and the data‑quality notes.
- Turnover is a derived answer: one definition, applied by the engine to the computed inputs and by the form to edited ones.
- A resolver that fails produces a per‑question failure with a message; the other questions are still answered.

## 5. Stack

- **pnpm workspaces.** The package boundaries enforce the layering, and each package is tested on its own. Turborepo was dropped: with five small packages, its caching and task ordering saved too little to justify another tool, and plain `pnpm -r` scripts are enough. The shared packages export their TypeScript source directly, so they need no build step.
- **Next.js 16 (App Router)**, **Mantine 8**, **Drizzle ORM + PostgreSQL** (Docker), **`docx`** for the Word export, **Zod** for validation, **Vitest** for tests.
- **Next.js:** server components read the data, server actions handle upload and save, and a promise passed to a client component inside `Suspense` streams the pre‑filled answers into the already rendered form.
- **Drizzle:** the schema is plain TypeScript, so there is no generate step or engine binary, and typed `jsonb` columns fit warnings, values and provenance. Migrations are SQL files generated by `drizzle-kit`.

## 6. Repository layout

| Package                                                | Role                                                        | Depends on         |
| ------------------------------------------------------ | ----------------------------------------------------------- | ------------------ |
| `apps/web`                                             | Next.js pages, server actions and form UI                   | all packages below |
| `packages/dsn`                                         | DSN parser                                                  | nothing            |
| `packages/questionnaire`                               | Question tree and mapping engine                            | `dsn`              |
| `packages/docx-export`                                 | Builds the Word file                                        | `questionnaire`    |
| `packages/db`                                          | Drizzle schema, migrations, seed (questions), shared client | nothing            |
| `packages/typescript-config`, `packages/eslint-config` | Shared configuration                                        | nothing            |

The domain packages (`dsn`, `questionnaire`, `docx-export`) never import `db` or `web`.

**Data model:**

- `DsnImport`: file, status (`PROCESSING` / `READY` / `FAILED`), company, period, employee count, warnings, and the mapping's table columns and failures, so a processed import is read back without recomputing.
- `Question`: seeded from the CSV.
- `Answer`: `computedValue`, `value`, `source` (`COMPUTED` / `MANUAL`) and provenance, all tracked per table cell.

**Design requirements (SOLID).** Every package must respect them; a review checks them:

- **Single responsibility:** one module per concern (parsing, code lists, breakdowns, resolvers, engine). A function does one thing; sorting, validating and counting are not mixed.
- **Open/closed:** adding a question, a breakdown, a block type or a code means adding an entry to a registry or a table, not editing the engine. Code never relies on the format of another module's keys or strings.
- **Liskov substitution:** every resolver, dimension or field spec honours the same contract (inputs, return shape, failure through the dedicated error), so the engine treats them alike.
- **Interface segregation:** packages export only what their consumers use; internal types and helpers stay private.
- **Dependency inversion:** domain packages depend on plain data types, never on the database, the framework or the web app. The web app adapts its rows to those types.
- Also: one definition per business rule (no logic duplicated between the engine and the form), no dead code or unreachable branches, no casts to silence the type checker.

## 7. User flow

1. **Upload (required).** The user can't go further without a file. The server does a quick check (size, encoding, first line is a DSN line), stores the file, creates the import as `PROCESSING`, and redirects immediately.
2. **Form shown at once.** All questions render immediately.
   - Questions the DSN can answer (known in advance from the mapping) are **locked**, with a "waiting for pre‑filled answers" indicator.
   - All other questions are editable straight away.
   - Answers are **streamed** to the page. Processing is safe to repeat: if the import is already `READY`, the saved answers are read instead of recomputed.
   - Processing sits behind one function, so it can later move to a background job without changing the UI. A row lock makes concurrent requests (refresh, two tabs) wait for the first run instead of computing twice.
3. **Answers arrive.** The locked fields unlock with their values, and a summary replaces the waiting banner (employees found, questions pre‑filled, warnings). Anything typed in the meantime is kept.
4. **Edit.** Pre‑filled values can be edited (marked "edited", with a "reset to computed" action). Turnover recalculates when its inputs change; it is read‑only, since editing its inputs is what changes it.
5. **Save and export.** Save is explicit and keeps the user on the page, and warns before leaving with unsaved changes. It is enabled once the pre‑filled answers have arrived and sends only the changed cells; the server validates them against the questions and the import's columns, and recomputes the derived answers with the same definition. An answer set back to its computed value is `COMPUTED` again. Export is disabled until pre‑filling has finished.

## 8. UX principles

- **Feedback at every step.** Say what the system is doing in plain words ("Reading your DSN…"), keep the layout stable, and never show a blank page.
- **Locked fields:** a waiting indicator inside the field, a tooltip explaining why, and table columns shown as placeholders until the data arrives. They use a read‑only state rather than `disabled`, so screen readers can still reach them, and the arrival of answers is announced.
- **Warnings and errors in business language**, each with a next step ("Upload another file", "Retry"). User input is never lost.
- **Failure handling:**
  - Fatal parsing error: show the message and offer a new upload; the form is hidden, as there is nothing to answer.
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
