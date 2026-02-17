# Multi-Repo Phase Plan: Mesh MCP + Agent + MCP Tooling

**Author**: Elmer Fudd (Project Manager)
**Date**: 2026-02-17
**Task**: #94
**Status**: Draft — awaiting team lead review

---

## Context & Inputs

This plan synthesizes 4 source documents:

1. **Mesh MCP Server PRD** — `agent-team/docs/specs/draft/mesh-mcp-server.md`
2. **Agent Wrapper PRD** — `agent/docs/specs/draft/agent-wrapper.md`
3. **MCP Tooling PRD** — `mcp/docs/specs/draft/mcp-tooling.md`
4. **Engineering Review** — `agent-team/.claude/tmp/mesh-mcp-engineering-review.md` (Bugs Bunny, Task #87)

### Key Decisions Already Made

- **Language**: TypeScript + Bun for all components. Exception: K8s controller = Go. (Task #90)
- **Two-process architecture**: Confirmed by engineering review. Remote mesh server + local MCP stdio client are separate components.
- **Socket.io**: Components should be separated as their own reusable package.

### Repos Involved

| Repo | Purpose | Primary work |
|:-----|:--------|:-------------|
| `nsheaps/mcp` | MCP tooling CLI + packages | Socket.io package, mesh server, mesh client, inspector, gateway, daemon, CLI |
| `nsheaps/agent` | Agent launcher wrapper | Config composition, profiles, MCP config assembly, launch command |
| `nsheaps/agent-team` | Agent team orchestration | Agent definitions, team docs, specs (specs live here, implementations elsewhere) |

---

## Architecture: Two-Process Design

Per the engineering review's critical finding, the mesh system is **two separate processes**:

```
┌─────────────────────────────────────────┐
│         REMOTE: Mesh Server              │
│  (Deployment, one or more instances)     │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Socket.io    │  │ Presence Manager│  │
│  │ Server       │  │                 │  │
│  └──────┬───────┘  └────────┬────────┘  │
│         │                    │           │
│  ┌──────┴───────┐  ┌────────┴────────┐  │
│  │ Message      │  │ Auth Module     │  │
│  │ Router       │  │ (JWT)           │  │
│  └──────────────┘  └────────────────-┘  │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ Group/Channel│  │ Redis Adapter   │  │
│  │ Manager      │  │ (Phase 3+)      │  │
│  └──────────────┘  └─────────────────┘  │
└────────────────────┬────────────────────┘
                     │ Socket.io (WSS)
                     │
┌────────────────────┴────────────────────┐
│         LOCAL: Mesh MCP Client           │
│  (Runs per-agent, MCP stdio server)      │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │ MCP Stdio    │  │ Socket.io       │  │
│  │ Interface    │  │ Client          │  │
│  │ (tools)      │  │ (reusable pkg)  │  │
│  └──────┬───────┘  └────────┬────────┘  │
│         │                    │           │
│  ┌──────┴───────┐  ┌────────┴────────┐  │
│  │ File Dumper  │  │ Hook Bridge     │  │
│  │ (local FS)   │  │ (Claude Code)   │  │
│  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘
         ↑
    Agent (Claude Code)
    connects via MCP stdio
```

### Package Separation

The Socket.io connection logic (client and server helpers) lives in a **standalone package** within the `mcp` monorepo:

```
nsheaps/mcp/
├── packages/
│   ├── socketio-transport/     ← Reusable Socket.io wrapper (Phase 1)
│   │   ├── src/
│   │   │   ├── client.ts       ← Connection, reconnection, heartbeat
│   │   │   ├── server.ts       ← Server setup, room management
│   │   │   ├── protocol.ts     ← Message envelope types, serialization
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mesh-server/            ← Remote mesh server (Phase 2)
│   │   └── ...
│   │
│   ├── mesh-client/            ← Local MCP stdio client (Phase 2)
│   │   └── ...
│   │
│   ├── mcp-cli/                ← CLI tool (Phase 5+)
│   │   └── ...
│   │
│   ├── inspector/              ← Inspector (Phase 6)
│   │   └── ...
│   │
│   ├── gateway/                ← Gateway (Phase 7)
│   │   └── ...
│   │
│   └── daemon/                 ← Daemon (Phase 7)
│       └── ...
```

---

## Phase Plan

### Phase 0: Monorepo Foundation

**Repo**: `nsheaps/mcp`
**Goal**: Set up the nx monorepo with Bun, shared tooling, and CI.
**Depends on**: Nothing

| Task | Description |
|:-----|:------------|
| 0.1 | Initialize nx workspace with Bun as package manager |
| 0.2 | Configure shared tsconfig, eslint, prettier |
| 0.3 | Set up CI (GitHub Actions: lint, typecheck, test) |
| 0.4 | Create `packages/` directory structure |
| 0.5 | Configure release-it for monorepo publishing |
| 0.6 | Add mise.toml for tool versions (bun, node) |

**Exit criteria**: `bun install`, `bun run lint`, `bun run typecheck` all pass. CI green.

---

### Phase 1: Socket.io Transport Package

**Repo**: `nsheaps/mcp` → `packages/socketio-transport`
**Goal**: Standalone, reusable Socket.io wrapper with no MCP dependency. This is the foundation for both mesh server and mesh client.
**Depends on**: Phase 0

| Task | Description |
|:-----|:------------|
| 1.1 | Create `packages/socketio-transport` with package.json |
| 1.2 | Define message envelope types (from PRD §9.1: id, type, from, to, group, text, metadata, timestamp, ttl) |
| 1.3 | Implement server wrapper: create server, handle connections, room management |
| 1.4 | Implement client wrapper: connect, reconnect with backoff, heartbeat monitoring |
| 1.5 | Implement message serialization/deserialization |
| 1.6 | Add event emitter interface for connection lifecycle (connect, disconnect, error, reconnect) |
| 1.7 | Unit tests for all components |
| 1.8 | Export as package (`@nsheaps/socketio-transport`) |

**Exit criteria**: Package builds, tests pass. Can create a server and client that exchange typed messages.

---

### Phase 2A: Mesh Server — Minimal MVP

**Repo**: `nsheaps/mcp` → `packages/mesh-server`
**Goal**: Remote mesh server with direct messaging and presence. No auth, no Redis, no groups.
**Depends on**: Phase 1

| Task | Description |
|:-----|:------------|
| 2A.1 | Create `packages/mesh-server` with Socket.io server using `socketio-transport` |
| 2A.2 | Implement connection handler: register agent, assign ID |
| 2A.3 | Implement presence manager: online/offline tracking via connect/disconnect events |
| 2A.4 | Implement direct message routing: sender → server → recipient, with delivery ack |
| 2A.5 | Implement message deduplication (rolling window of seen IDs, per PRD §9.3) |
| 2A.6 | Add CLI entry point: `bun run mesh-server --port 3456` |
| 2A.7 | Add basic logging (structured JSON, connection events, message routing) |
| 2A.8 | Unit + integration tests |

**Exit criteria**: Server starts, accepts Socket.io connections, routes direct messages between connected clients, tracks presence. Testable with raw Socket.io client scripts.

---

### Phase 2B: Mesh MCP Client — Minimal MVP

**Repo**: `nsheaps/mcp` → `packages/mesh-client`
**Goal**: Local MCP stdio server that agents connect to. Bridges MCP tool calls to remote Socket.io server.
**Depends on**: Phase 1, Phase 2A

| Task | Description |
|:-----|:------------|
| 2B.1 | Create `packages/mesh-client` with MCP stdio server using `@modelcontextprotocol/sdk` |
| 2B.2 | Implement `mesh/connect` tool: connect to remote mesh server via Socket.io client |
| 2B.3 | Implement `mesh/send` tool: send direct message to another agent |
| 2B.4 | Implement `mesh/presence` tool: query online agents from server |
| 2B.5 | Handle incoming messages: buffer received messages, expose via MCP resource or notification |
| 2B.6 | Add CLI entry point: `bun run mesh-client --server ws://localhost:3456 --agent-id my-agent` |
| 2B.7 | Unit + integration tests |

**Exit criteria**: An MCP client (e.g., Claude Code) can connect to the mesh client stdio server, call `mesh/connect`, `mesh/send`, `mesh/presence`, and receive messages from other agents.

---

### Phase 2C: End-to-End Integration Test

**Repo**: `nsheaps/mcp`
**Goal**: Prove two agents can message each other through the full stack.
**Depends on**: Phase 2A, Phase 2B

| Task | Description |
|:-----|:------------|
| 2C.1 | Write E2E test: start mesh server, start two mesh clients, exchange messages |
| 2C.2 | Write E2E test: presence updates when agents connect/disconnect |
| 2C.3 | Write E2E test: message delivery failure when recipient is offline |
| 2C.4 | Add E2E test runner to CI |

**Exit criteria**: Automated E2E tests pass in CI. Two simulated agents can communicate via MCP tools.

---

### Phase 3A: Groups

**Repo**: `nsheaps/mcp` → `packages/mesh-server` + `packages/mesh-client`
**Goal**: Add group messaging using Socket.io rooms.
**Depends on**: Phase 2C

| Task | Description |
|:-----|:------------|
| 3A.1 | Implement group manager in mesh-server (create, join, leave, list using Socket.io rooms) |
| 3A.2 | Add `mesh/group-join`, `mesh/group-leave`, `mesh/group-list` tools to mesh-client |
| 3A.3 | Extend `mesh/send` to support `group` parameter for group broadcasts |
| 3A.4 | Add group presence (list members of a group) |
| 3A.5 | Unit + integration + E2E tests for group messaging |

**Exit criteria**: Agents can join groups, send group messages, and see group membership.

---

### Phase 3B: Authentication

**Repo**: `nsheaps/mcp` → `packages/mesh-server`
**Goal**: JWT-based authentication for mesh connections.
**Depends on**: Phase 2C (can be parallel with 3A)

| Task | Description |
|:-----|:------------|
| 3B.1 | Implement JWT token generation (team token mode — shared secret per team) |
| 3B.2 | Add auth middleware to Socket.io server (validate JWT on connection) |
| 3B.3 | Scope group access to token claims (per PRD §5.3) |
| 3B.4 | Scope messaging to same-team agents |
| 3B.5 | Update mesh-client to pass token on connect |
| 3B.6 | Add rate limiting (per-agent message rate, per PRD §12.3) |
| 3B.7 | Tests for auth flows, rejection, rate limiting |

**Exit criteria**: Unauthenticated connections are rejected. Agents can only message within their team. Rate limits enforced.

---

### Phase 3C: File Dumper + Hook Bridge

**Repo**: `nsheaps/mcp` → `packages/mesh-client`
**Goal**: Write incoming messages to local filesystem and trigger Claude Code hooks.
**Depends on**: Phase 2B, **requires hook research** (PRD open question #1)

| Task | Description |
|:-----|:------------|
| 3C.0 | **BLOCKER**: Research which Claude Code hook type is best for message injection (Notification? PreToolUse? UserPromptSubmit?) |
| 3C.1 | Implement file dumper: write incoming messages to `~/.claude/mesh/{agent}.jsonl` |
| 3C.2 | Implement trigger file: touch `~/.claude/mesh/{agent}.trigger` on new message |
| 3C.3 | Implement hook bridge script (`mesh-inbox-hook.sh`) that reads inbox, injects as system-reminder |
| 3C.4 | Document hook configuration for Claude Code settings |
| 3C.5 | E2E test: agent receives mesh message in conversation context |

**Exit criteria**: A Claude Code agent receives mesh messages injected into its conversation via hooks. Messages appear without manual polling.

---

### Phase 4: Agent Wrapper MVP

**Repo**: `nsheaps/agent`
**Goal**: Basic `agent launch` command that assembles MCP configs, settings, and flags.
**Depends on**: Phase 0 (for build tooling patterns), independent of mesh phases

| Task | Description |
|:-----|:------------|
| 4.1 | Initialize repo with Bun, tsconfig, CI |
| 4.2 | Define config file format (`.agent.yaml` per PRD) |
| 4.3 | Implement config resolver: defaults < base profile < MCP overlays < project config < user config < CLI flags |
| 4.4 | Create 2 base profiles: `solo-developer`, `team-member` |
| 4.5 | Implement MCP config assembly (merge MCP server configs from named presets) |
| 4.6 | Implement `agent launch` CLI command that outputs the assembled claude launch command |
| 4.7 | Add `--dry-run` flag to show assembled command without executing |
| 4.8 | Integration test: `agent launch --profile team-member --dry-run` produces valid command |

**Exit criteria**: `agent launch` assembles and optionally executes a fully-configured agent launch command.

---

### Phase 5: MCP CLI MVP

**Repo**: `nsheaps/mcp` → `packages/mcp-cli`
**Goal**: Basic MCP server management commands.
**Depends on**: Phase 0

| Task | Description |
|:-----|:------------|
| 5.1 | Create `packages/mcp-cli` with CLI framework (commander or similar) |
| 5.2 | Implement `mcp list-installed` — discover installed MCP servers across clients |
| 5.3 | Implement `mcp install <server>` — install a server for a specified client |
| 5.4 | Implement `mcp uninstall <server>` — remove a server config |
| 5.5 | Implement `mcp doctor` — basic health check suite |
| 5.6 | Add client detection: auto-discover Claude Code, Cursor, etc. |
| 5.7 | Tests for all commands |

**Exit criteria**: `mcp install github --client claude-code` correctly adds the GitHub MCP server to Claude Code's config.

---

### Phase 6: Inspector

**Repo**: `nsheaps/mcp` → `packages/inspector`
**Goal**: Web UI for inspecting MCP server tools, resources, and live calls.
**Depends on**: Phase 5

| Task | Description |
|:-----|:------------|
| 6.1 | Create `packages/inspector` |
| 6.2 | Implement MCP inspection proxy (intercepts MCP calls between client and server) |
| 6.3 | Build web UI: show available tools, resources, prompts |
| 6.4 | Add live call viewer: display intercepted MCP requests/responses |
| 6.5 | Implement `mcp server inspect <server>` CLI command to launch inspector |
| 6.6 | Tests |

**Exit criteria**: `mcp server inspect my-server` opens a web UI showing the server's tools and live traffic.

---

### Phase 7A: Gateway

**Repo**: `nsheaps/mcp` → `packages/gateway`
**Goal**: Proxy layer providing auth, policy, and audit for MCP servers.
**Depends on**: Phase 5

| Task | Description |
|:-----|:------------|
| 7A.1 | Create `packages/gateway` |
| 7A.2 | Implement basic proxy: forward MCP calls between client and server |
| 7A.3 | Add authentication middleware |
| 7A.4 | Add tool allowlist/blocklist policy enforcement |
| 7A.5 | Add audit logging |
| 7A.6 | Add rate limiting |
| 7A.7 | Tests |

**Exit criteria**: MCP calls routed through gateway are authenticated, policy-checked, and logged.

---

### Phase 7B: Daemon

**Repo**: `nsheaps/mcp` → `packages/daemon`
**Goal**: Singleton process manager for MCP servers.
**Depends on**: Phase 5

| Task | Description |
|:-----|:------------|
| 7B.1 | Create `packages/daemon` |
| 7B.2 | Implement `mcp run-once -- <command>`: start server as singleton |
| 7B.3 | Implement multiplexer: subsequent clients connect to existing instance via streaming HTTP |
| 7B.4 | Add ephemeral mode (shutdown after idle timeout) |
| 7B.5 | Add persistent mode (run until stopped) |
| 7B.6 | Tests |

**Exit criteria**: Multiple agents can share one MCP server instance managed by the daemon.

---

### Phase 8: Redis Clustering for Mesh

**Repo**: `nsheaps/mcp` → `packages/mesh-server`
**Goal**: Horizontal scaling of mesh server via Redis adapter.
**Depends on**: Phase 3A, Phase 3B

| Task | Description |
|:-----|:------------|
| 8.1 | Add Redis adapter to Socket.io server |
| 8.2 | Configure sharded adapter for Redis 7.0+ |
| 8.3 | Add sticky session support documentation for Ingress |
| 8.4 | Test cross-server message delivery |
| 8.5 | Document message ordering limitation across servers (per engineering review §3.5) |
| 8.6 | Load test: multiple server instances with Redis |

**Exit criteria**: Mesh server runs as 2+ replicas coordinated via Redis. Messages route correctly across instances.

---

### Phase 9: Kubernetes Deployment

**Repo**: `nsheaps/mcp` (manifests in `deploy/`)
**Goal**: K8s manifests for mesh server, gateway, daemon.
**Depends on**: Phase 8 (for mesh server), Phase 7A (for gateway), Phase 7B (for daemon)

| Task | Description |
|:-----|:------------|
| 9.1 | Create Helm chart or kustomize base for mesh server (Deployment + Service + Ingress) |
| 9.2 | Add Redis StatefulSet manifests |
| 9.3 | Create manifests for gateway (Deployment + Service) |
| 9.4 | Create manifests for daemon (DaemonSet or StatefulSet) |
| 9.5 | Add ConfigMap/Secret templates for auth tokens |
| 9.6 | Test in local k8s (kind or minikube) |

**Exit criteria**: `kubectl apply` deploys functional mesh server, gateway, and daemon in a k8s cluster.

---

### Phase 10: Message Persistence + History

**Repo**: `nsheaps/mcp` → `packages/mesh-server`
**Goal**: Messages survive server restart; agents can query history.
**Depends on**: Phase 8

| Task | Description |
|:-----|:------------|
| 10.1 | Add Redis Streams for message persistence |
| 10.2 | Implement `mesh/history` tool: retrieve last N messages per group/channel |
| 10.3 | Add message TTL and cleanup |
| 10.4 | Tests for persistence across server restart |

**Exit criteria**: Messages persist through server restart. Agents can query recent history.

---

### Phase 11: Advanced Mesh Features

**Repo**: `nsheaps/mcp`
**Goal**: WebRTC P2P, cross-cluster federation, webhook ingestion.
**Depends on**: Phase 8, Phase 9

| Task | Description |
|:-----|:------------|
| 11.1 | WebRTC P2P optimization for latency-critical agent pairs (optional overlay) |
| 11.2 | Cross-cluster federation bridge |
| 11.3 | Webhook ingestion endpoint (external events → mesh messages) |
| 11.4 | MCP sampling integration for intelligent routing |

**Exit criteria**: Advanced features operational for teams that need them.

---

### Phase 12: K8s Controller (Go)

**Repo**: `nsheaps/agent` or new `nsheaps/agent-controller`
**Goal**: Kubernetes CRD and controller for agent lifecycle management.
**Depends on**: Phase 4 (agent wrapper), Phase 9 (k8s deployment)
**Language**: **Go** (controller-runtime / kubebuilder)

| Task | Description |
|:-----|:------------|
| 12.1 | Define Agent CRD (spec: profile, MCP configs, team, resources) |
| 12.2 | Scaffold controller with kubebuilder |
| 12.3 | Implement reconciler: create/update/delete agent pods based on CRD |
| 12.4 | Integration with mesh server (auto-register agents, inject auth tokens) |
| 12.5 | Add team-level CRD for managing agent groups |
| 12.6 | Tests with envtest |

**Exit criteria**: `kubectl apply -f agent.yaml` launches a fully configured agent pod connected to the mesh.

---

## Dependency Graph

```
Phase 0 (monorepo foundation)
  ├── Phase 1 (socketio-transport package)
  │     ├── Phase 2A (mesh server MVP)
  │     │     └── Phase 2B (mesh client MVP)
  │     │           └── Phase 2C (E2E tests)
  │     │                 ├── Phase 3A (groups)
  │     │                 ├── Phase 3B (auth) [parallel with 3A]
  │     │                 └── Phase 3C (file dumper + hooks) [requires research]
  │     │                       └── Phase 8 (Redis clustering)
  │     │                             └── Phase 9 (k8s deployment)
  │     │                                   └── Phase 10 (persistence)
  │     │                                         └── Phase 11 (advanced features)
  │     │                                               └── Phase 12 (k8s controller, Go)
  │     │
  ├── Phase 5 (MCP CLI MVP) [parallel with mesh track]
  │     ├── Phase 6 (inspector)
  │     ├── Phase 7A (gateway)
  │     └── Phase 7B (daemon)
  │
  └── Phase 4 (agent wrapper MVP) [parallel with all above]
```

## Parallelization Opportunities

These phase groups can run **in parallel**:

1. **Mesh track**: Phases 0 → 1 → 2A → 2B → 2C → 3A/3B/3C → 8 → 9 → 10 → 11
2. **MCP CLI track**: Phases 0 → 5 → 6, 7A, 7B (all parallel after 5)
3. **Agent wrapper track**: Phase 4 (independent after Phase 0 patterns established)
4. **K8s controller**: Phase 12 (independent Go project, starts after Phase 4 + 9)

---

## Blockers & Risks

| Risk | Impact | Mitigation |
|:-----|:-------|:-----------|
| **Claude Code hook type for message injection** (PRD open question #1) | Blocks Phase 3C entirely | Research before Phase 3C starts; Phase 2 MVP works without hooks |
| **Socket.io vs raw WebSockets debate** (engineering review §3.2) | Architecture choice affects Phase 1 | Decision: start with Socket.io for rooms/reconnection; can replace transport layer later since it's behind `socketio-transport` abstraction |
| **Message ordering across Redis instances** (engineering review §3.5) | May surprise users | Document limitation clearly; single-server is fine for most teams |
| **Sticky sessions with Socket.io clustering** (engineering review §3.4) | Ops complexity | Delay Redis/clustering to Phase 8; most teams won't need it |
| **Agent wrapper config format stability** | Changing format breaks users | Mark as unstable/beta until Phase 4 complete |

---

## Open Questions for Team Lead

1. **Phase 3C blocker**: Should Road Runner research the Claude Code hook type question now, or do we wait until Phase 2C is done?
2. **Socket.io package naming**: `@nsheaps/socketio-transport` or something more descriptive?
3. **Phase 4 timing**: Should the agent wrapper start in parallel with Phase 1, or wait until mesh proves out?
4. **Helm vs Kustomize**: Preference for Phase 9 k8s manifests?
5. **Where should the K8s controller live?** In `nsheaps/agent` or a separate `nsheaps/agent-controller` repo?

---

## References

- [Mesh MCP Server PRD](https://github.com/nsheaps/agent-team/blob/main/docs/specs/draft/mesh-mcp-server.md)
- [Agent Wrapper PRD](https://github.com/nsheaps/agent/blob/main/docs/specs/draft/agent-wrapper.md)
- [MCP Tooling PRD](https://github.com/nsheaps/mcp/blob/main/docs/specs/draft/mcp-tooling.md)
- Engineering Review — `.claude/tmp/mesh-mcp-engineering-review.md` (Task #87)
- Language Decision — Task #90 (TypeScript/Bun for all, Go for K8s controller only)
