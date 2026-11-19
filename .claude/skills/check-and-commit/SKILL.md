---
name: check-and-commit
description: Verify the Kiosk repo and commit the work. Runs what CI runs (format, lint, typecheck, tests, build), starts the app against the Docker Postgres and checks the home page renders, then commits the changes in the repo's message style. Use when the user asks to run the tests, run or check the app, or commit / "ship" a finished step.
---

# Check and commit

Three phases, in order. Stop at the first failure: report it with the relevant output and do not
commit. Never commit failing work, and never push.

## 1. Static checks and tests (same as CI)

Run from the repo root:

```bash
pnpm format:check
pnpm check        # lint, typecheck, then vitest in every package
pnpm build        # next build; needs no database
```

- If only `format:check` fails, run `pnpm format`, show which files changed, and rerun it.
- Report the test counts per package (the `Tests  N passed` lines).

## 2. Run the app

1. `.env` must exist at the root; if not, copy `.env.example`.
2. Start the database and apply migrations: `pnpm db:up && pnpm db:migrate && pnpm db:seed`
   (the seed is idempotent).
3. Start your own dev server on port 3100, so it never clashes with the user's on 3000 (and port
   3000 can be held by other tools, e.g. a VS Code helper): `pnpm dev --port 3100` with
   `run_in_background`, output redirected to a log file in the scratchpad.
4. Check the routes:
   - Poll `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100` until it returns 200 (up
     to 60 s), and check the page contains `Upload and pre-fill`.
   - Upload `dsn.txt` through the server action. Its id is the key whose `exportedName` is
     `uploadDsn` in `apps/web/.next/dev/server/app/page/server-reference-manifest.json`. React
     reads the root field `0` last, so the file field must come first:
     `curl -s -D - -o /dev/null -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Origin: http://localhost:3100" -F "_1_file=@dsn.txt;type=text/plain" -F '0=[{"error":null},"$K1"]' http://localhost:3100/`
     must return an `x-action-redirect: /imports/<id>` header. The same call with
     `questions.csv` must return a `does not look like a DSN` error.
   - Fetch the redirect target. React splits text with `<!-- -->` comments, so strip them first:
     `curl -s http://localhost:3100/imports/<id> | sed 's/<!-- -->//g'` must contain
     `Reading your DSN…` (the streamed fallback), `100 employees found` and
     `15 questions pre-filled`.
   - Save through the `saveAnswers` action (its id is in
     `apps/web/.next/dev/server/app/imports/[id]/page/server-reference-manifest.json`):
     `curl -s -H "Next-Action: $ID" -H "Accept: text/x-component" -H "Origin: http://localhost:3100" -H "Content-Type: text/plain;charset=UTF-8" --data '["<id>",[{"questionId":"S1-6_11","columnKey":"","value":4}]]' http://localhost:3100/imports/<id>`
     must return `{"ok":true}`, and the `answer` table must then hold S1-6_11 = 4 and S1-6_12
     (turnover) = 4, both `MANUAL`. Sending `S1-6_12` itself must return `"ok":false`.
   - The dev log must have no `⨯` lines.
5. Stop the server you started (`lsof -ti tcp:3100 | xargs kill`). Leave Postgres running.

As pages are added (form, export), extend step 4 with a check of each new route.

## 3. Commit

1. `git status` and `git diff` to see everything that changed. If on `main`, create a branch named
   after the build step first (e.g. `upload-flow`).
2. Before committing, make sure the docs match the code: the "Project status" line in `CLAUDE.md`
   and, when a decision changed, `implementation-plan.md` (lean, code-free).
3. Stage files by name. Never stage `.env`, secrets, `node_modules`, build output or scratch files.
4. Write the message in the style of `git log`:
   - subject: imperative, ≤ 60 characters, no trailing period (e.g. "Add the DSN parser");
   - body wrapped at 72 columns: a short paragraph on what the change does and why, then `-`
     bullets for the notable decisions;
   - end with the attribution trailer from the current system instructions, if any.
5. Commit with a heredoc so the formatting is kept, then show `git log -1 --stat`.

## Report

Finish with a short summary: checks passed (with test counts), app status (URL checked, what it
showed), and the commit hash and subject. Mention anything skipped and why.
