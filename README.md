# Kiosk DSN case study

Upload a DSN file, parse it on the server, map its data to the S1‑6 workforce questions, review and edit the answers in one form, and export them to Word.

- **Brief:** [`project-scope.md`](project-scope.md)
- **Plan and decisions:** [`implementation-plan.md`](implementation-plan.md), written before the code and kept up to date

## Running the project

**Requirements:** Node 24 (see `.nvmrc`), pnpm 11, Docker.

```bash
cp .env.example .env   # database URL, matches docker-compose.yml
pnpm install
pnpm bootstrap         # starts Postgres in Docker, applies migrations, seeds questions.csv
pnpm dev               # http://localhost:3000
```

Then upload `dsn.txt` from the repo root.

| Command                                           | What it does                                              |
| ------------------------------------------------- | --------------------------------------------------------- |
| `pnpm check`                                      | Lint, typecheck and tests in every package (what CI runs) |
| `pnpm format:check`, `pnpm build`                 | The two other CI steps; the build needs no database       |
| `pnpm --filter @kiosk/dsn test`                   | One package's tests (same for `lint`, `typecheck`)        |
| `pnpm db:reset`, `pnpm db:seed`, `pnpm db:studio` | Reset the database, reseed the questions, browse the data |
| `pnpm db:down`                                    | Stop Postgres                                             |

## What it does

1. **Upload.** The upload is required. The server does a quick check (size, encoding, first line looks like a DSN line), stores the file and redirects at once to the import page.
2. **Form shown at once.** Every question renders immediately. Questions the DSN can answer are locked with a "waiting for pre‑filled answers" indicator; the others are editable straight away.
3. **Answers stream in.** Parsing and mapping run on the server and the answers are streamed into the already rendered form. The locked fields unlock with their values, and a summary shows the employees found, the questions pre‑filled and any data‑quality warnings. Anything typed meanwhile is kept.
4. **Edit and save.** Pre‑filled values can be changed (marked "edited", with "reset to computed"). Each answer shows how it was computed and from which rubriques. Turnover recalculates when its inputs change. Save sends only the changed cells and warns before leaving with unsaved changes.
5. **Export.** Downloads a `.docx` with the saved answers: sections as headings, questions as label/value lines, tables as Word tables.

Errors are in business language with a next step: a file that isn't a DSN offers a new upload, a question that can't be computed unlocks empty with an explanation, and processing that runs over 30 s offers a retry.

## Architecture

A pnpm workspace. The package boundaries enforce the layering, and ESLint forbids the domain packages from importing the database or the web app.

```
apps/web                 Next.js 16 (App Router) + Mantine 8: pages, server actions, form UI
packages/dsn             DSN parser. Pure TypeScript, no dependencies
packages/questionnaire   Question tree + mapping engine        → dsn
packages/docx-export     Word document (docx library)          → questionnaire
packages/db              Drizzle schema, migrations, question seed, client
packages/*-config        Shared TypeScript and ESLint configuration
```

- **`dsn`** works in two stages. Lines become a block tree, driven by a declarative parent/child table and a stack of the latest open block of each type. Then a field spec per block reads the needed rubriques into a typed, JSON‑safe model (ISO dates, line numbers kept for provenance). Bad values become warnings with line numbers, never crashes; the import fails only if the file isn't a DSN or has no employees. Repeated blocks are kept as lists, so nothing is overwritten. This avoids the problems of the reference `DSNReader.js`, which never records errors, overwrites earlier establishments, merges consecutive blocks of the same type and crashes on unexpected block order.
- **`questionnaire`** builds the question tree from `questions.csv` rows and maps a parsed DSN onto it. Mapping is driven by three registries: `RESOLVERS` (one function per question), `TABLE_BREAKDOWNS` (the dimensions that make a table's columns) and `DERIVED_ANSWERS` (answers computed from other answers). DSN code meanings live only in `code-lists.ts`. `mapDsn` never throws: a failing resolver becomes a failure for that question only.
- **`docx-export`** separates layout (what the document says, as format‑free blocks, unit‑tested) from rendering (mapping those blocks to `docx`).
- **`db`** stores the import (file, status, period, warnings, table columns, failures), the questions, and one answer per question and table cell with both `computedValue` and the user's `value`, a `source` (`COMPUTED` / `MANUAL`) and the provenance.
- **`web`** keeps pages thin. Database access lives in `src/server/` behind `server-only`. `processImport` is the single processing entry point: idempotent, row‑locked so a refresh or second tab waits instead of computing twice, with a 30 s timeout. The page passes its promise unawaited to a client component that reads it with `use()` inside `Suspense`, which is how the form appears before the answers. The form state is a pure, tested reducer, and an edit re-renders only the input that changed.

### Trade‑offs

- **Redirect straight after upload, process afterwards.** The questions don't depend on the answers: the question tree comes from `questions.csv`, and which questions the mapping can answer is known from the registries before any DSN is read. So the upload only does a quick check, stores the file and redirects, and the whole form renders at once. Only the pre‑filled values wait for processing, and the user can fill in the other questions meanwhile instead of watching a spinner.
- **Drizzle rather than Prisma.** The schema is plain TypeScript (no generate step or engine binary), typed `jsonb` columns suit warnings, values and provenance, and migrations are reviewable SQL files.
- **Processing in the request, not a job queue.** For a 100‑employee file it takes well under a second. It sits behind one function, so moving it to a background job later doesn't change the UI.
- **Explicit save, no autosave.** Simpler to reason about and to validate on the server. The server recomputes derived answers with the same definition as the form, so client and server always agree.
- **Tables are two‑dimensional.** The brief says a table's child questions are its rows. The columns come from the breakdown named in the table title (country, contract × gender, region, category) and use the values actually found in the data.
- **Scope is the shape of `dsn.txt`.** One company, one establishment, one contract per employee, no contract ends. The model and the mapping already count by unique employee and keep repeated blocks as lists, so richer files need new rules, not a rewrite (see Next steps).

### Performance

- **Form first, compute once.** The upload redirects before any parsing, and the form is streamed while the answers follow inside `Suspense`. Results are stored when the import is processed, so later visits, saves and exports read them back; a row lock stops a refresh or a second tab from computing twice, and a 30 s timeout turns a stuck run into a retry.
- **Light edits and saves.** Typing re-renders only the input being edited (a pure reducer split across two contexts, memoised inputs). A save sends only the changed cells and writes them in one statement; the computed answers are also inserted in one statement.
- **Linear parsing, bounded uploads.** The parser reads the file in one pass and the mapping counts each breakdown in one pass through a `Map`. Uploads are capped at 4 MB, checked in the browser and on the server. Beyond that size, files would go straight from the browser to S3 through a pre‑signed URL, so they never pass through the Next server, and processing would read them from there.

## Mapping rationale

`dsn.txt` is generated test data: only sex (`S21.G00.30.005`) and the payment dates (`S21.G00.50.001`) are reliable. Contract types, statuses and the declared month are mostly not valid codes. The parser keeps every code as a raw value, and the mapping sends unknown codes to "Other / Unknown" with a note saying how many employees were affected and why. The aim was to show a mapping that is correct for a real DSN and honest about a fake one.

**Reporting period.** The declared month `S20.G00.05.005` when the payment dates fall in it; otherwise the whole months spanned by the payment dates. In the sample the declared month is 1946‑07‑20, so the period is November–December 2025. Pay periods (`.51`) are not used because in the sample they run into January 2026.

| Question                             | Source and method                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1‑6_02 Employees at end of period   | Employees with a contract active on the last day (started by then, not ended before), counted once by identifier                       |
| S1‑6_03 Average during period        | Mean of the head‑count on the first and last day. A single DSN is one declaration, so this is a documented approximation               |
| S1‑6_11 Leavers                      | Contract ends `S21.G00.62` dated in the period, excluding cancellations (reason `099`). 0 on the sample, with a note saying why        |
| S1‑6_12 Turnover %                   | Leavers ÷ average head‑count × 100. A derived answer: the same definition runs in the engine, the form and the save action             |
| S1‑6_05/06 By country                | Establishment country `S21.G00.11.015`; empty means France                                                                             |
| K_718/719 Contract type × gender     | `S21.G00.40.007` grouped into permanent / temporary / non‑guaranteed hours (`07`, CDI intermittent) / other, crossed with sex `30.005` |
| S1‑6_09/10 By region                 | Establishment postal code → département → région; "Outside France" when a country is set (the sample's `IR`)                           |
| S1‑6_19/20 By category               | First digit of the PCS‑ESE code `S21.G00.40.004` (groups 1–6), falling back on the cadre status `S21.G00.40.003`                       |
| S1‑6_14 Methodology, S1‑6_15 Timing  | Pre‑filled with "Head‑count" and "At end of period", since that is how every figure above is computed; editable                        |
| S1‑6_16 Context                      | Generated text: company SIREN, period and how it was chosen, employees found, data‑quality warnings                                    |
| S1‑6_17 Link to financial statements | Left to the user: the DSN does not contain the financial statements                                                                    |

- Each computed answer stores its **provenance** (method in plain words, rubriques used, notes), shown next to the answer in the form.
- Breakdowns are combinations of reusable **dimensions** (gender, contract type, country, région, category). Each dimension knows its rubriques and what counts as unknown, which feeds both the columns and the data‑quality notes.
- Adding a question, a breakdown or a code means adding an entry to a registry or a code list, not editing the engine.

## How I used AI

I worked with Claude Code (Anthropic) throughout, as a pair programmer under my direction rather than as an autopilot.

- **Planning first.** Before writing code I read the brief, the sample files and the DSN specification with Claude, and we wrote `implementation-plan.md` together: scope, parsing approach, mapping table, stack, user flow, UX principles and build order. I made the decisions; Claude researched, challenged and wrote them up. The plan stayed the source of truth and was updated whenever a decision changed.
- **Project context for the agent.** `CLAUDE.md` records the commands, conventions and the domain facts that aren't obvious from the files (the irregular CSV, the generated DSN values, how the sample's period is derived), so each session starts from the same ground.
- **Reading the specification.** The 375‑page DSN technical spec was extracted to text and searched by rubrique code to check meanings (contract types, PCS‑ESE, cadre status, end reasons).
- **Step by step.** Each build step of the plan was implemented in its own session and commit, with tests alongside the code.
- **Review and verification tooling**, committed in `.claude/`:
  - a `code-reviewer` subagent that reviews a step against the project rules (layering, SOLID requirements of the plan, error handling, Next 16 idioms) and reports findings without editing;
  - a `check-and-commit` skill that runs what CI runs, starts the app against Postgres to check it renders, and only then commits.
- **What I kept for myself:** the architecture and scope decisions, the user flow and UX, the mapping choices, and the final review of every change. AI output was treated as a draft to check, not as an answer.

## Next steps

- **Larger and more complete DSNs:** several establishments, several contracts per employee, contract ends and changes (`S21.G00.41`); upload big files straight to S3 with pre‑signed URLs and parse them line by line; group warnings by type.
- **Background processing** with a queue (for example pg-boss on the existing Postgres), the page following the import status.
- **Several DSNs per year,** for true averages over the year and annual leavers.
- **Full‑time equivalents** as an alternative to head‑counts.
- **User‑configurable mapping rules,** so a customer can correct how its codes are grouped.
- **UX:** French/English labels (the CSV has both), autosave, edit history, horizontal scroll for wide tables, an upload progress bar.
- **Quality and operations:** authentication, Playwright end‑to‑end tests of the upload → edit → export flow.
