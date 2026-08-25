# DECISIONS NEEDED

> **Aug 22, 2026 — this file never reached GitHub.** The run that wrote it could not push (403,
> read-only access — see the `infra` entry under OPEN). Everything below, plus the full run report
> and the hand-test checklists, is published here instead:
> **https://claude.ai/code/artifact/f7b41c3e-4c94-4913-8c2b-44074d709d74**

Questions raised by autonomous runs that only the owner can answer. Agents append here; they
never answer for him.

**How this works:** answer inline under a question (edit the `> ANSWER:` line). The next run reads
this file before picking up work, applies any newly answered decisions, finishes the task that was
blocked on it, and moves the question to the Resolved section at the bottom.

---

## OPEN

### family-proposal — six decisions on the household model (NOT blocking any queued task)
**Blocks:** nothing in `queue/` right now. TASK_12 itself cannot be built until these are answered —
four of the six change the database schema, and a schema migrated twice is the expensive mistake.
Listing them here because this is the file you read, and they're the highest-value thing on the board.

**The questions, with my recommendation on each** (full options and trade-offs in
`.agent/features/FEATURE_family_households.md`, and restated plainly in `AGENT_LOG.md`):

1. Captured recipes private to your household, or visible to all families? — *rec: private*
2. Do the 400 imported recipes stay one global read-only copy? — *rec: yes* (sub-question: what happens when someone edits one)
3. Can one person belong to two households? — *rec: allow in the schema, show one in the UI*
4. Roles, or all members equal? — *rec: equal, keep an unused `role` column*
5. Does the household keep the plan/recipes when a member leaves? — *rec: yes, but record who created what*
6. How does your wife get onboarded? — *rec: invite link + password, never a typed code*

> ANSWER 1:
> ANSWER 2:
> ANSWER 3:
> ANSWER 4:
> ANSWER 5:
> ANSWER 6:

---

### infra — this session cannot push to GitHub (read-only access)
**Blocks:** every task in the queue, retroactively. Work is committed locally on `feat/tier-1-batch`
but `git push` returns **403** from GitHub (not the proxy), and the GitHub MCP tools — authenticated
as you — return *"Resource not accessible by integration"* on `push_files`, `create_or_update_file`
and `git/trees` alike. Reads and fetches work fine. Nothing this run produces survives the sandbox
until this is fixed.

**Options:**
- **A.** Grant the Claude GitHub App write access to `callepimpalot/the-foodies` — claude.ai
  Settings → Connectors → GitHub, or https://claude.ai/admin-settings/claude-tag. Then re-run the
  routine; it is idempotent and will re-do the work cleanly.
- **B.** Apply the work by hand from the patch I published as a fallback (link in `AGENT_LOG.md`).
  Works, but it's manual and gets worse with every run that can't push.

**My recommendation:** A. B is a one-time rescue, not a fix — the routine is scheduled, so every
future run hits the same wall until write access exists.

> ANSWER:

---

## RESOLVED

### Taste model — five decisions · resolved Aug 21, 2026 in session
Rating format, skippability, event granularity, history window, and member attribution.
Recorded in full in `.agent/features/FEATURE_taste_model.md` under DECISIONS.
