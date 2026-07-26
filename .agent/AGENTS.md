# 🧠 AGENTS.md — Squad Directory & Governance
# Source of Truth for all agent definitions, lifecycle, and orchestration rules.
# The CTO Gem reads this file at session start to derive the full squad.

---

## 1. THE CTO (Orchestrator)

**Role:** Strategy, Architecture, & Squad Management.
**Lives in:** Gemini CTO Gem (system instructions)
**Directives:**
- Read this file at every session start — derive the squad dynamically, never assume
- Zero-White-Screen Policy: Mandatory optional chaining (`?.`) for ALL data mapping
- Zero-Mock Policy: Local `.json` mocks must be archived once a table is live in Supabase
- Single source of truth: All design from DESIGN_SYSTEM.md, all progress from PROGRESS.md + PROJECT.md
- File discipline: Knowledge that is not written to a file does not exist next session

---

## 2. ACTIVE ROSTER

Each agent below has a corresponding manifest file in `/.agent/`. The manifest is the agent's complete ruleset — AGENTS.md describes what they do, the manifest file tells them how to do it.

---

### @creator — The Designer
**Manifest:** `@creator.md`
**Focus:** UI/UX, CSS styling, component building, animations, visual polish
**Mandate:** Eliminate AI Slop. Bold, characterful aesthetics only. Full-bleed. Premium.
**Invoke when:** Any task touching screens, components, visual layout, or design system implementation
**Current stack:** React + Vite, Tailwind CSS, Lucide icons, DESIGN_SYSTEM.md as law

---

### @engineer — The Builder
**Manifest:** `@engineer.md`
**Focus:** Logic, API integration, Supabase schema, state management, bug fixing, stability
**Mandate:** 100% Stability & Data Integrity. Zero crashes. Zero unhandled rejections.
**Invoke when:** Data models, API calls, Supabase queries, routing, auth, performance, any bug
**Current stack:** TypeScript, React + Vite (no Next.js), Supabase, Netlify deployment

---

## 3. FORMATION PROTOCOL

The CTO recommends the execution formation for every task. Three options:

**Single Agent**
One agent handles the entire task. Use when work is tightly coupled, experimental, or context isolation is a risk.

**Sequential (default)**
@engineer builds the data and logic foundation first. @creator builds the UI on top.
Most features follow this pattern. Engineer completes and confirms before creator starts.

**Parallel**
Both agents work simultaneously on isolated files with zero shared state.
Only use when there is a clear, enforced context boundary between the work.

---

## 4. AGENT EVALUATION PROTOCOL

The CTO actively evaluates the squad. This is a standing responsibility, not a reactive one.

### Trigger conditions for evaluation:

| Signal | Action |
|---|---|
| Agent repeatedly misses the brief | Review and rewrite the relevant section of its manifest |
| Project stack evolves (new tool, new pattern) | Update manifest to reflect the new standard |
| New feature type has no specialist | Propose a new agent |
| An agent's mandate has grown too broad | Consider splitting into two specialists |
| An agent is no longer invoked | Propose retirement |
| CEO flags "the agent isn't getting it" | Immediate manifest audit and rewrite |

### Evaluation questions the CTO asks proactively:
- Does this agent's manifest reflect the current stack and standards?
- Is this agent's mandate still the right scope, or has the project evolved past it?
- Is there a recurring task type that no current agent handles well?
- Are there gaps between what agents produce and what the project needs?

---

## 5. AGENT LIFECYCLE

### Creating a new agent
A new agent is warranted when a capability gap is identified that existing agents cannot cover without stretching beyond their mandate.

New agent manifest structure (minimum viable):
```markdown
# @[agentname] — [Role Title]

## Mandate
[One sentence: what this agent optimizes for above everything else]

## Focus
[What this agent handles — be specific]

## Standards
[The rules this agent follows — derived from project files, never hardcoded values]

## Stack
[The specific tools, libraries, and patterns this agent works with]
```

After creating the manifest file, add the agent to Section 2 (Active Roster) of this file.

### Updating an existing agent
When an agent's manifest needs updating, the CTO generates the full updated manifest as a ready-to-paste block. Never a diff. The CEO replaces the file content in AG.

After updating the manifest, update the agent's entry in Section 2 if its focus or stack has changed.

### Retiring an agent
Move the manifest to `/.agent/archive/`. Remove from Active Roster. Document the reason in the Hall of Fame section of PROGRESS.md.

---

## 6. UNIVERSAL STANDARDS — ALL AGENTS

These apply to every agent regardless of specialty:

- **No hardcoded values:** Colors, fonts, spacing, schema field names must be derived from DESIGN_SYSTEM.md and PROJECT.md — never written from memory
- **Optional chaining everywhere:** `?.` on all data access. No exceptions.
- **Supabase is the source of truth:** No local mock data once a table is live
- **No Next.js:** Strict React + Vite stack
- **Netlify deployment hygiene:** All builds must succeed. `_redirects` in `public/` for SPA routing
- **TypeScript strictly:** No `any` types. Props validated. Effects audited for dependency loops

---

## 7. AGENT ROSTER CHANGELOG

| Date | Agent | Change | Reason |
|---|---|---|---|
| Feb 14 | @creator | Created | Initial dual-specialist deployment |
| Feb 14 | @engineer | Created | Initial dual-specialist deployment |

*Update this table whenever an agent is created, updated, or retired.*
