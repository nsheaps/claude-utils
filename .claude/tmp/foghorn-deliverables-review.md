# Foghorn Deliverables Review — Tasks #42 and #43

**Reviewer:** Wile E. Coyote (Team Coach)
**Date:** 2026-02-15
**Task:** #49

---

## Task #42 — nsheaps/agent repo PRD

**File:** `~/src/nsheaps/agent/docs/specs/draft/agent-wrapper.md`
**Repo:** `~/src/nsheaps/agent/`

### Checklist

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | PRD exists at `docs/specs/draft/agent-wrapper.md` | PASS | Present, 157 lines |
| 2 | Covers wrapper for launching agents with premade MCP/settings | PASS | Sections: Premade MCP Configs (§3.1), Settings Management (§3.2), Agent Launch (§3.3), Config Composition (§3.4) |
| 3 | Covers relationship to agent-team and claude-utils | PASS | Table at lines 22-28 maps all 4 repos (agent-team, agent, claude-utils, mcp) with purpose and relationship columns |
| 4 | Tech comparison (bunx vs Rust vs Go) | PASS | Full comparison table (lines 83-88) with pros/cons for each, plus key considerations and recommendation |
| 5 | Config format documented | PASS | `.agent.yaml` project-level and `~/.agent/config.yaml` user-level examples with YAML (lines 114-141) |
| 6 | K8s controller path addressed | PASS | Mentioned in tech considerations (line 79, 91, 101) — "rewrite in Go when k8s controller path becomes concrete" |
| 7 | Standard repo tooling (mise.toml, prettier) | PASS | `mise.toml` has bun, fmt, fmt-check, lint, test tasks; `package.json` has prettier dev dep |

### Assessment: **7/7 PASS**

### Quality Notes

- **Strengths:**
  - Clean separation of concerns in the repo relationship table
  - Config composition section clearly defines resolution order (defaults < base < MCP overlays < project < user < CLI flags)
  - Open questions section is thoughtful (5 well-scoped questions)
  - Distribution section covers Homebrew, npm/bunx, container image, GitHub Releases

- **Minor observations (not failures):**
  - Tech recommendation hedges ("needs user decision") which is appropriate for a draft PRD
  - The flow diagram at line 29 (`claude-utils scripts → agent wrapper → agent runtime`) is clear but only exists as inline text — a diagram could help later
  - License is UNLICENSED — presumably intentional for now

---

## Task #43 — nsheaps/mcp repo PRD

**File:** `~/src/nsheaps/mcp/docs/specs/draft/mcp-tooling.md`
**Repo:** `~/src/nsheaps/mcp/`

### Checklist

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | PRD exists at `docs/specs/draft/mcp-tooling.md` | PASS | Present, 210 lines |
| 2 | Component: Inspector | PASS | §4.1, lines 20-31 — web UI + terminal-based, modeled after @modelcontextprotocol/inspector |
| 3 | Component: Gateway | PASS | §4.2, lines 33-51 — proxy layer with current scope + future enterprise features (auth, policy, audit, rate limiting, credential injection) |
| 4 | Component: Daemon | PASS | §4.3, lines 53-73 — singleton process manager, multiplexed connections, ephemeral/persistent modes |
| 5 | Component: Server Management | PASS | §4.4, lines 75-82 — install/uninstall/list/search/info/registry commands |
| 6 | Component: Client Management | PASS | §4.5, lines 84-90 — client discovery, install/uninstall, project configure |
| 7 | Component: Dynamic Tool Calling | PASS | §4.6, lines 92-98 — dynamic server, dynamic proxy, direct CLI invocation |
| 8 | Component: Agent Integration Hooks | PASS | §4.7, lines 100-106 — incoming-hook with push/pull models, message queueing |
| 9 | Component: P2P Communication | PASS | §4.8, lines 108-113 — WebRTC proxy + TypeScript library for embedding |
| 10 | Component: Health Checks | PASS | §4.9, lines 115-121 — mcp doctor with suites (client-parity, server-smoke) |
| 11 | All 9 components covered | PASS | Confirmed all 9 present |
| 12 | Tech comparison | PASS | Lines 123-148 — bunx vs Rust vs Go table with recommendation (bun+TS+nx start, Go/Rust for perf-critical later) |
| 13 | K8s deployment model | PASS | Lines 151-170 — table mapping components to k8s patterns (Deployment, StatefulSet, DaemonSet, CRD), controller SDK considerations |
| 14 | Distribution strategy | PASS | Lines 173-183 — Homebrew, npm/bunx, container images, GitHub Releases |
| 15 | Standard repo tooling | PASS | `mise.toml` has bun, fmt, fmt-check, lint, test tasks; `package.json` has prettier dev dep |

### Assessment: **15/15 PASS**

### Quality Notes

- **Strengths:**
  - Comprehensive coverage — all 9 components are well-defined with clear CLI command patterns
  - Gateway section smartly separates current scope from future enterprise features
  - Daemon architecture section clearly explains the singleton/multiplex model with ephemeral vs persistent modes
  - K8s table is excellent — maps each component to appropriate k8s pattern with notes
  - Current state of repo documented (§2, lines 3-10) — helpful for context
  - References section includes links to MCP spec, SDK, Anthropic advanced tool use, and related repos

- **Minor observations (not failures):**
  - 6 open questions at end are well-scoped and track real decisions needed
  - Repo relationship table (lines 187-191) correctly maps all 4 repos including this one
  - Vision statement (line 16) is concise and accurate

---

## Overall Verdict

| Task | Deliverable | Result |
|------|-------------|--------|
| #42 | agent repo PRD | **PASS** (7/7) |
| #43 | mcp repo PRD | **PASS** (15/15) |

Both repos have standard tooling (mise.toml with bun/fmt/lint/test, prettier, proper package.json). Both PRDs are draft-quality documents in the correct location (`docs/specs/draft/`). Both cover all required topics per team-lead's checklist.

Foghorn delivered solid work on both tasks.
