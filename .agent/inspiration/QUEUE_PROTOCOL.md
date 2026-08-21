# QUEUE PROTOCOL — how autonomous execution works

A scheduled cloud agent wakes periodically and processes this queue. This file is its
operating manual. It is the ONLY thing the routine's prompt needs to point at.

```
.agent/inspiration/
  TASK_NN_*.md    the specs — the full brief for each candidate task
  queue/          APPROVED work, ready to execute. The worker reads only this.
  done/           finished work, moved here after a successful push
  rail.html       the dashboard — what's built, what needs you, what to test
  AGENT_LOG.md    append-only record of every run
```

**Nothing is executed unless it is in `queue/`.** Putting a task there is the act of
approving it. The backlog in `README.md` is candidates, not commitments.

---

## THE LOOP

1. `git checkout feat/tier-1-batch && git pull && npm install`
2. Read `CLAUDE.md`, `.agent/DATA_MODELS.md`, `.agent/DESIGN_SYSTEM.md`.
3. List `queue/*.task.md`. For each, read its header.
4. Pick the **lowest `priority` number** among tasks where:
   - `autonomous: true`
   - every id in `depends_on` is already in `done/`
   If nothing qualifies, append a line to `AGENT_LOG.md` saying so, commit, push, stop.
5. Read the task's `brief` file and every task spec it names. **Those are the specification.**
6. Do the work. Stay inside the task's `owns` list — never edit a file another queued task owns.
7. Run every command in `gate`. **All must pass.** Iterate until they do.
8. Update `rail.html` and `AGENT_LOG.md` (see below).
9. `git mv` the task file from `queue/` to `done/`, commit, and **push to `feat/tier-1-batch`**.
10. If budget remains, go back to step 3 for the next task.

## HARD RULES

- **Never commit to `main`. Never merge. Never open a pull request.** Netlify auto-deploys from
  `main`; merging would put unverified code into production.
- **Always push** to `feat/tier-1-batch`. Unpushed work dies with the sandbox.
- **Never execute a task marked `autonomous: false`.** Those need a human decision first —
  executing one means guessing at a choice that isn't yours. Skip it and say so in the log.
- **Never mark a task done that did not pass its gate.** Leave it in `queue/`, commit the partial
  work with a `wip:` prefix naming exactly what remains, push, and log it honestly.
- No dev server, no browser, no deploy in this environment. Verify via check scripts, `npx eslint`,
  and `npm run build`. `VITE_*` env vars are absent; the build still succeeds.
- Be idempotent. Inspect state before acting. If the work is already done, log it and stop.

## UPDATING THE DASHBOARD

`rail.html` holds a `STATUS` map and a `TESTS` object near the top of its `<script>`.

- Move each finished task to `"built"`. Leave anything unfinished as `"running"`.
  **Never claim work you did not finish** — a false green is worse than an honest red.
- Add entries to `TESTS` for what only a human at a real device can check. Match the existing
  entries' shape and tone. These become the owner's checklist when he returns.
- Set `"needs-you"` on any task you had to stop on because it required a decision, and say what
  the decision is in `AGENT_LOG.md`.

## THE TASK FILE FORMAT

```
---
id: short-slug
title: Human-readable name
model: opus | sonnet | haiku      # opus where judgment matters, haiku for mechanical work
autonomous: true | false          # false = needs a human decision before it can start
priority: 1                       # lower runs first
depends_on: [other-id]            # must be in done/ first
owns: [paths the task may edit]   # collision avoidance between queued tasks
brief: FILENAME.md                # the detailed spec to follow
gate: [commands that must all pass before it counts as done]
---
Free text: anything else the worker needs, especially judgment calls and known traps.
```

---

## UNCERTAINTY PROTOCOL — the most important rule here

**Never guess at a decision that is the owner's to make.** He is away and cannot be asked mid-run.
A wrong guess is worse than unfinished work, because unfinished work is visible and a wrong guess
looks finished.

When you hit something you cannot resolve from the task file, the specs, or the codebase:

1. **Go as far as you can without it.** Do every part of the task that does not depend on the
   answer. Most decisions block one slice, not the whole job. Do not down tools on the first
   uncertainty.
2. **Append the question to `DECISIONS_NEEDED.md`** under OPEN, in this shape:

   ```
   ### <task-id> — <one-line question>
   **Blocks:** what specifically cannot be finished until this is answered
   **Options:** the real choices, with the trade-off of each
   **My recommendation:** which you'd pick and why — but do NOT implement it
   > ANSWER:
   ```

   Be specific enough that he can answer by writing one line, without opening the code.
3. **Commit the partial work** with a `wip:` prefix naming exactly what remains.
4. **Leave the task file in `queue/`.** Do not move it to `done/` — it isn't.
5. **Set that task to `"needsyou"`** in the `STATUS` map in `rail.html`, so the dashboard shows it
   as blocked rather than in progress.
6. **Push**, then move on to the next eligible task in the queue. One blocked task must not stall
   the rest.

On a later run, **read `DECISIONS_NEEDED.md` before picking up work.** If a question now has an
`ANSWER:` filled in, apply it, finish that task, and move the question down to RESOLVED with the
date. Answered decisions take priority over starting new work — the owner is waiting on those.

### What counts as "the owner's decision"

- Anything that changes what the product does, rather than how it is built.
- Any trade-off where both options are defensible and the choice is about his life, not the code
  (how much friction he'll tolerate, whether he'd maintain a feature, what he'd actually use).
- Anything irreversible or expensive to undo — schema shapes, data you cannot backfill later.
- Anything the task file itself marks as open.

### What does NOT count — decide these yourself

- Naming, file layout, code structure, which helper to extract.
- How to test something, or which assertion to write.
- Anything the specs already answer if you read them properly. **Read first, ask second** — a
  question whose answer is in `DATA_MODELS.md` wastes his time and yours.
