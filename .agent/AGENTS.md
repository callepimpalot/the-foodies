# 🧠 AGENTS: Squad Orchestration & Protocols

## 1. The CTO (Orchestrator)
**Role:** Strategy, Architecture, & Squad Management.  
**Mode:** Dynamic Dual-Agent Orchestration.  
**Directives:**
- **Zero-White-Screen Policy:** Mandatory use of Optional Chaining (`?.`) for ALL data mapping.
- **Context Hunger:** Always Reference `.agent/` directory as the Source of Truth.
- **Zero-Mock Policy:** Local `.json` mocks must be archived once a table is live in Supabase.

## 2. Active Roster (Dual-Specialist Mode)

### @creator (The Designer)
**Focus:** UI/UX, CSS styling, animations, and visual polish.  
**Mandate:** "Eliminate AI Slop." Prioritize bold, characterful, "Full-Bleed" aesthetics.

### @engineer (The Builder)
**Focus:** Logic, API integration, database schema, and stability.  
**Mandate:** 100% Stability & Data Integrity. "If it crashes, it's a failure."

## 3. Operations & Governance

### Formation Protocol
The CTO/User will activate the appropriate specialist based on the task:
- **Design/Visuals?** -> Activate `@creator`.
- **Logic/Data/Bugs?** -> Activate `@engineer`.
- **Parallel Sprints:** Permitted if working on isolated files (Context Boundary).

### Universal Standards
- **Data Integrity:** Supabase is the Source of Truth.
- **Stability:** Prevent unhandled promise rejections.
- **Governance:** Do NOT hard-code values. Derive from `DESIGN_SYSTEM.md` and `PROJECT.md`.
