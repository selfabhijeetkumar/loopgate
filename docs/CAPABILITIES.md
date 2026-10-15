# CAPABILITIES.md
<!-- Phase 0 environment inspection -->
<!-- Last updated: 2026-10-15 -->

## 1. MCP Servers Available

### StitchMCP
- Status: ACTIVE (lazy-loaded)
- Tools: create_project, get_project, delete_project, list_projects, list_screens, get_screen, generate_screen_from_text, edit_screens, generate_variants, upload_design_md, create_design_system, create_design_system_from_design_md, update_design_system, list_design_systems, apply_design_system
- Phase use: P0 design exploration (3 visual directions), design token export
- Existing project found: "PRISM Command Center" (id: 9417568307750762899) - prior project, do NOT modify
- New project created: "Loopgate Sentinel Facility" (id: 3068430008025736304)
- Risk: generate_screen_from_text has 3-minute timeout; retry via get_screen if timeout

### context7
- Status: ACTIVE (lazy-loaded)
- Tools: resolve-library-id, query-docs
- Phase use: P1-P8, fetch live library docs (React Three Fiber, Three.js, GSAP, Transformers.js, Next.js, Tailwind, Vitest, Zod)

### supabase
- Status: ACTIVE (lazy-loaded) but NOT applicable to Loopgate
- Reason: No database, no login, no RLS in scope
- Decision: Do not use. Document skipped in SECURITY_PLAN.md.

---

## 2. Built-in Antigravity Skills

| Skill | Phase Use |
|-------|-----------|
| codebase-mapper | P1 (after scaffold, map structure) |
| context-compressor | All phases (token budget) |
| context-fetch | All phases (search-first discipline) |
| context-health-monitor | All phases (degrade before overflow) |
| debugger | P2-P8 (systematic bugs) |
| empirical-validation | Every phase gate (proof required) |
| executor | P1-P8 (each phase execution) |
| plan-checker | Before each phase (validate plan) |
| planner | P1 (decompose BUILD_PLAN phases into tasks) |
| subagent-delegation | P0-P8 (parallel work) |
| token-budget | All phases |
| verifier | Every phase gate |

---

## 3. Subagent / Delegation Capability

- invoke_subagent: AVAILABLE (Antigravity 2.0+)
- browser_subagent: AVAILABLE (for research, Stitch fallback, testing)
- Delegation mode: branch (isolated worktrees) for P1 onwards
- P0 delegates research to browser_subagents in parallel

---

## 4. GSD Workflow Suite

Workflows available at c:\LOOPGATE\.agent\workflows\:
/execute, /plan, /verify, /map, /debug, /pause, /resume, /progress,
/new-milestone, /complete-milestone, /add-phase, /insert-phase, /remove-phase,
/sprint, /add-todo, /check-todos, /audit-milestone, /web-search, /whats-new

GSD Agent definitions at c:\LOOPGATE\.agents\agents\:
- gsd-executor.md (phase execution)
- gsd-planner.md (plan authoring)
- gsd-verifier.md (verification)
- gsd-researcher.md (research)
- gsd-debugger.md (debugging)

GSD .gsd/ state: SPEC.md and STATE.md initialized.

---

## 5. Code Review Graph

- Location: c:\LOOPGATE\.code-review-graph\ (graph.db present, 3.1MB)
- Tool: Code Review Graph is installed
- Phase use: P6-P8 code review before final commit

---

## 6. GenAI & Animation Constraints (Phase 0 Corrections & Stack Override)

- **Gemini Free-Tier Model & Limits (2026):**
  - Gemini 2.0 Flash is retired/deprecated in 2026; free tier limits cut.
  - Active model configurable via `GEMINI_MODEL` env var (default: `gemini-2.5-flash` or `gemini-2.5-flash-lite`, whichever is free/available).
  - Design constraint: Worst-case ~5 RPM / 100 RPD.
  - Gemini is **OPTIONAL and never in the critical path**: at most one call per upload, cached by client-side image hash (SHA-256), with deterministic template fallback always available.
  - Zero claims of 15 RPM / 1,500 RPD.
- **Animation Stack Override:**
  - Framer Motion is **BANNED** per stack override.
  - All animation uses **GSAP**, **CSS transitions**, and **React Three Fiber** only.

---

## 7. Phase Assignment

| Capability | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 |
|------------|----|----|----|----|----|----|----|----|-----|
| StitchMCP design | X | | | | | | | | |
| context7 docs | | X | X | X | X | X | X | X | X |
| GSD executor skill | | X | X | X | X | X | X | X | X |
| GSD verifier skill | | X | X | X | X | X | X | X | X |
| browser_subagent | X | | | X | | | | | X |
| Code Review Graph | | | | | | | | | X |
| Vitest | | X | X | X | X | X | X | X | X |

---

## 8. What Does NOT Exist

- No CodeRabbit config found (not installed, not needed for hackathon)
- No database (Supabase skipped by design)
- No auth system
- No CI/CD pipeline (Vercel Git integration handles deploy)
- No analytics (no cookies; Privacy page states this)
