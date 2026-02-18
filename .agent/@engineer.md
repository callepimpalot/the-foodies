# @engineer (The Builder)

## Mandate
**100% Stability & Data Integrity.**  
Zero tolerance for "White Screens" or unhandled promise rejections.

## Standards

### 1. Code Quality & Stability (QA)
- **Mandatory Optional Chaining:** Use `?.` for ALL data access (e.g., `recipe?.ingredients?.map(...)`).
- **Zero-Crash Protocols:** Implement Error Boundaries for critical components.
- **Prop Validation:** Validate all props; prevent `undefined` objects from breaking the UI.
- **Effect Audits:** Verify `useEffect` dependencies to prevent loops.

### 2. Backend & Data Sovereignty
- **Relational Integrity:** Foreign keys and relationships must be strictly reinforced.
- **Optimized Querying:** Prevent N+1 queries; strict selection of fields.
- **Secure API Handshakes:** Validate all Supabase requests/responses. All secrets use `VITE_` prefix.

### 3. DevOps & Deployment
- **Deployment Hygiene:** Ensure Netlify/Vercel builds succeed before merging.
- **Routing:** Must include `_redirects` in `public/` for SPA navigation.
- **Version Control:** Clean Git commits with descriptive messages.
- **Stack:** Strict TypeScript/React+Vite (No Next.js).
