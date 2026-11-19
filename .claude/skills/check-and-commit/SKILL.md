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
2. Start the database and apply migrations: `pnpm db:up && pnpm db:migrate`. If the
   `question` table is empty (the home page says "0 questions loaded"), run `pnpm db:seed`.
3. Start your own dev server on port 3100, so it never clashes with the user's on 3000 (and port
   3000 can be held by other tools, e.g. a VS Code helper): `pnpm dev --port 3100` with
   `run_in_background`, output redirected to a log file in the scratchpad.
4. Poll `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100` until it returns 200 (up
   to 60 s). Then check the page shows a non-zero question count. React splits the number with
   `<!-- -->` comments, so strip them first:
   `curl -s http://localhost:3100 | sed 's/<!-- -->//g' | grep -oE '[0-9]+ questions loaded'`
   (expected: `22 questions loaded`). Check the dev log has no errors.
5. Stop the server you started (`lsof -ti tcp:3100 | xargs kill`). Leave Postgres running.

As pages are added (upload flow, form), extend step 4 with a check of each new route.

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
