# Research: MCP Servers for Shell Scripts as Tools & Structured Documents as Tools+Resources

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: (1) Do MCP servers exist that expose shell scripts as tools with input/output schemas? (2) Do MCP servers exist that serve structured documents via tools (descriptions always visible) + resources (full content on demand)?

## Executive Summary

**Yes to both.** The MCP ecosystem has mature solutions for exposing shell scripts as tools, with MCPShell and mcptools being the strongest options. For structured documents, several projects exist but none perfectly match the "rules in tool descriptions + full content via resources" pattern — most use tools-only or resources-only, not both strategically. Building a custom MCP server that combines these approaches would be novel and valuable.

---

## Part 1: Shell Scripts as MCP Tools

### 1.1 MCPShell (inercia/MCPShell) — BEST FIT

**What it does**: Turns shell scripts into MCP tools via YAML configuration. Each tool definition specifies a command template, typed parameters, and security constraints.

**Configuration format** (YAML):
```yaml
mcp:
  tools:
    - name: disk_usage
      description: "Analyze disk usage of a directory"
      params:
        directory:
          type: string
          description: "Directory to analyze"
          required: true
        max_depth:
          type: number
          description: "Maximum depth to analyze"
          default: 2
      constraints:
        - "directory.startsWith('/')"
        - "!directory.contains('..')"
        - "max_depth >= 1 && max_depth <= 3"
      run:
        command: |
          du -h --max-depth={{ .max_depth }} {{ .directory }}
```

**Key features**:
- **YAML-based tool definitions** — point at scripts or inline commands
- **Typed parameters** with defaults and `required` flags
- **CEL (Common Expression Language) constraints** — validate inputs before execution (path traversal prevention, value bounds, character whitelists)
- **Template substitution** — `{{ .param_name }}` in commands
- **Optional sandboxing** for command isolation
- **stdio transport** (standard MCP)

**Installation**: Go-based CLI
```bash
go run github.com/inercia/MCPShell@v0.1.8 mcp --tools tools.yaml
```

**Relevance to agent-team**: High — could define team management operations (spawn, kill, status) as YAML tool definitions. CEL constraints add safety layer.

**Gap**: You still write YAML per tool. No "point at a directory and auto-discover" mode.

**Confidence**: High — [GitHub](https://github.com/inercia/MCPShell), [mcp.so listing](https://mcp.so/server/mcpshell/inercia)

### 1.2 mcptools Proxy Mode (f/mcptools) — SIMPLEST SETUP

**What it does**: CLI tool that can register shell scripts as MCP tools on-the-fly via `mcp proxy tool add_operation`.

**Usage**:
```bash
# Register a shell script as a tool
mcp proxy tool add_operation "Adds a and b" "a:int,b:int" ./examples/add.sh

# Register an inline command
mcp proxy tool add_operation "List files" "dir:string" "ls -la $dir"
```

**How parameters work**: Parameters are passed as environment variables to the script. Script output becomes the tool response.

**Configuration**: Saved to `~/.mcpt/proxy_config.json` — persists tool registrations.

**Key features**:
- **One-liner registration** of any script
- **Language-agnostic** — scripts can be bash, python, node, etc.
- **Inline parameter spec** — `"name:type,name:type"` syntax
- **Both stdio and HTTP transport**
- **Also a general MCP CLI** (inspect servers, call tools, pipe data)

**Installation**:
```bash
go install github.com/f/mcptools/cmd/mcptools@latest
# or: brew install mcptools
```

**Relevance to agent-team**: Medium-High — quickest way to prototype shell-script-as-tool. Less structured than MCPShell (no YAML schema, no CEL constraints). Good for rapid iteration.

**Gap**: No auto-discovery. No security constraints. Basic parameter types only.

**Confidence**: High — [GitHub](https://github.com/f/mcptools), [README](https://github.com/f/mcptools/blob/master/README.md)

### 1.3 mcp-framework (QuantGeekDev) — FRAMEWORK, NOT SHELL-SPECIFIC

**What it does**: TypeScript framework for building MCP servers with **automatic directory-based discovery** of tools, resources, and prompts.

**Structure**:
```
src/
├── tools/          ← Auto-discovered MCP tools
├── resources/      ← Auto-discovered MCP resources
├── prompts/        ← Auto-discovered MCP prompts
└── index.ts        ← Server entry point
```

**Key features**:
- **Auto-discovery from `tools/` directory** — this is the closest to "point at a directory"
- **Zod-based type safety** for parameter schemas
- **Multiple transports** (stdio, SSE, HTTP Stream)
- **CLI scaffolding** for new projects
- **Built on official MCP SDK**

**Relevance to agent-team**: Medium — it's a TypeScript framework, not a shell-script wrapper. You'd write tools in TS that call shell scripts. But the auto-discovery pattern is exactly what the team lead described. Could serve as the foundation for a custom server that auto-discovers `.sh` files and generates tool schemas from them.

**Gap**: Tools must be TypeScript classes, not raw shell scripts. The auto-discovery is for TS modules, not scripts.

**Confidence**: High — [GitHub](https://github.com/QuantGeekDev/mcp-framework)

### 1.4 Other Shell-to-MCP Options

| Project | Approach | Notes |
|:--------|:---------|:------|
| `@mako10k/mcp-shell-server` ([npm](https://www.npmjs.com/package/@mako10k/mcp-shell-server)) | Executes shell commands via MCP | More "run any command" than "scripts as tools" — configurable allowed working directories |
| `tumf/mcp-shell-server` ([GitHub](https://github.com/tumf/mcp-shell-server)) | Shell execution with ALLOW_COMMANDS env var | Allowlist-based security model |
| `mkusaka/mcp-shell-server` ([GitHub](https://github.com/mkusaka/mcp-shell-server)) | Multi-line shell support, multiple shell types | bash, zsh, fish, powershell, cmd |
| `sonirico/mcp-shell` ([GitHub](https://github.com/sonirico/mcp-shell)) | Auditable shell command execution | Focuses on security audit trail |

### 1.5 The Gap: Auto-Discovery from a Script Directory

**No existing project fully matches**: "Point at a directory of shell scripts → each script automatically becomes a tool with input/output schemas."

The closest approaches are:
1. **mcp-framework**: Auto-discovers from a directory, but expects TypeScript modules
2. **MCPShell**: Structured tool definitions, but requires manual YAML per tool
3. **mcptools proxy**: One-liner registration, but no auto-discovery

**What would be needed for the ideal solution**:
1. Scan a directory for `.sh` files
2. Parse a frontmatter/header comment from each script to extract: name, description, parameter definitions
3. Generate MCP tool schemas automatically
4. Serve via stdio or SSE

**Example convention** (proposed):
```bash
#!/usr/bin/env bash
# @tool spawn-agent
# @description Spawn a new agent in the team
# @param name:string:required Agent display name
# @param role:string:required Agent role (researcher, engineer, etc.)
# @param model:string:optional Model to use (default: sonnet)

# Script body here...
echo "Spawning agent: $name with role: $role"
```

**Confidence**: High — verified across 8+ projects; none offer full auto-discovery with schema generation.

---

## Part 2: Structured Documents as MCP Tools + Resources

### 2.1 The Specific Use Case

The team lead's requirement: An MCP server where:
- **Tool descriptions** contain the important rules (always visible in tool listings, surviving Claude's deferred tool loading)
- **Resource URIs** let you fetch the full document content on demand
- This serves org-wide rules/docs

This is a **dual-channel** approach: critical summaries via tools (always in context), full content via resources (on-demand). No existing project does exactly this, but several come close.

### 2.2 rules-mcp (rules-mcp/rules-mcp) — CLOSEST TO REQUIREMENTS

**What it does**: MCP server that makes user-defined rules accessible to AI agents. Rules are defined in Markdown with YAML frontmatter.

**Rule definition format**:
```markdown
---
name: error-handling
description: "Always use structured error types, never throw raw strings"
tags: [typescript, quality]
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# Error Handling Rules

1. Use custom Error classes that extend BaseError
2. Include error codes for programmatic handling
3. Log errors with structured context
...
```

**How it works**:
- Points at a `rules/` directory
- Parses frontmatter for metadata
- Exposes tools for listing, searching, and retrieving rules
- Supports `alwaysApply` for rules that should always be in context
- Tag-based and glob-based filtering

**Installation**:
```bash
npx -y rules-mcp /path/to/rules
```

**Relevance to agent-team**: High — the closest to the dual-channel pattern. Rules with `alwaysApply: true` are always loaded (similar to putting summaries in tool descriptions). Other rules are fetched on demand. However, it uses **tools** for both listing and retrieval, not MCP resources.

**Gap**: Does not use MCP resources — everything is tools. The tool descriptions don't contain the rules themselves (just the tool's purpose). The rules content is returned when the tool is called.

**Confidence**: High — [GitHub](https://github.com/rules-mcp/rules-mcp)

### 2.3 MCPRules (bartwisch/MCPRules) — CATEGORY-BASED RULES SERVER

**What it does**: MCP server that manages programming guidelines and rules with category-based organization.

**Categories**: Core Programming Principles, Code Style and Formatting, Language-Specific Guidelines, Project Management Rules, OS-Specific Rules

**Key features**:
- **Local and GitHub-hosted rules** — pull rules from a GitHub repo
- **Markdown-based rule definitions**
- **Category filtering** via tools
- **Flexible storage** — local filesystem or GitHub

**Relevance to agent-team**: Medium — good for serving coding standards but doesn't implement the dual-channel (tool descriptions + resources) pattern.

**Confidence**: Medium-High — [GitHub](https://github.com/bartwisch/MCPRules)

### 2.4 claude-critical-rules-mcp (optimaquantum) — TOOL-DESCRIPTION PATTERN

**What it does**: MCP server that provides 21 critical rules organized into 5 categories, with automatic verification checklists.

**How it approaches tool descriptions**: The tool `critical-rules:verify_compliance` is designed to be called before any technical task. The tool description itself tells the agent to call it. This is the closest existing example to "put important rules in the tool description so they're always visible."

**Key tools**:
- `verify_compliance` — displays 21-point checklist
- Quick reference guides
- Version checking
- Auto-update from GitHub

**Relevance to agent-team**: Medium — demonstrates the pattern of using tool descriptions as a forcing function (the description tells the agent when to call it). But it's hard-coded to a specific rule set, not a general-purpose document server.

**Confidence**: High — [GitHub](https://github.com/optimaquantum/claude-critical-rules-mcp)

### 2.5 library-mcp (lethain) — MARKDOWN KNOWLEDGE BASE

**What it does**: MCP server for exploring Markdown knowledge bases. Enables tag-based and date-range retrieval of Markdown files.

**Tools exposed**:
- `get_by_date_range` — retrieve content within time periods
- `get_by_slug_or_url` — access posts by identifier
- `list_all_tags` — enumerate tags
- `search` — text search across content

**Key insight**: Designed for "dynamically building datapacks relevant to the current question" — pull relevant content into context on demand.

**Relevance to agent-team**: Medium — demonstrates a well-designed content retrieval pattern. But it's tools-only (no MCP resources), and the tool descriptions describe the tool's function, not the content itself.

**Confidence**: High — [GitHub](https://github.com/lethain/library-mcp), [Blog post](https://lethain.com/library-mcp/)

### 2.6 docs-mcp-server (arabold) — DOCUMENTATION SEARCH ENGINE

**What it does**: Scrapes, processes, indexes, and searches documentation from websites, GitHub, npm, PyPI, and local folders. Supports HTML, Markdown, PDF, Word. Uses semantic chunking, embeddings, and hybrid search (vector + full-text).

**Key features**:
- **Multi-source**: websites, GitHub repos, local folders, zip archives
- **Rich format support**: HTML, Markdown, PDF, Word
- **Semantic chunking** with embeddings
- **Version-aware search**
- **Multiple embedding providers**: OpenAI, Google Gemini/Vertex AI, Azure, AWS Bedrock
- **Docker deployment** option

**Relevance to agent-team**: Medium — powerful for external documentation search but overkill for serving internal org rules. More suited for "search React docs" than "serve our team's coding standards."

**Confidence**: High — [GitHub](https://github.com/arabold/docs-mcp-server)

### 2.7 agent-rules-mcp (4regab) — RULES FROM GITHUB REPOS

**What it does**: Enables agents to access coding rules from any GitHub repository, replacing workspace rules files with MCP-served rules.

**Relevance**: Medium — interesting for pulling rules from remote repos, but doesn't implement the dual-channel pattern.

**Confidence**: Medium — [GitHub](https://github.com/4regab/agent-rules-mcp)

### 2.8 The Gap: Dual-Channel (Tool Descriptions + Resources)

**No existing project implements the exact pattern described:**

> Tool descriptions contain rule summaries (always visible in tool listings) + Resource URIs serve full document content (fetched on demand)

The closest approaches:
1. **rules-mcp**: Has the right content model (markdown with frontmatter) but uses tools-only
2. **claude-critical-rules-mcp**: Demonstrates putting guidance in tool descriptions but is hardcoded
3. **library-mcp**: Good retrieval patterns but tools-only

**What a custom server would look like**:

```
MCP Server: org-rules
├── Tools (always visible in tool listing):
│   ├── code-quality-rules
│   │   description: "CRITICAL: Always run tests before committing.
│   │                 Never push to main directly. Use conventional commits.
│   │                 Call this tool to get the full code quality ruleset."
│   ├── security-rules
│   │   description: "CRITICAL: Never commit secrets. Use env vars for credentials.
│   │                 Validate all user input. Call for full security guidelines."
│   └── architecture-rules
│       description: "CRITICAL: Max 1000 lines per file. Max 50 lines per function.
│                     No circular dependencies. Call for full architecture docs."
│
├── Resources (fetched on demand via URI):
│   ├── rules://code-quality/full → Full code quality document (500 lines)
│   ├── rules://security/full → Full security document (300 lines)
│   ├── rules://architecture/full → Full architecture document (800 lines)
│   └── rules://all → Complete ruleset
```

**Why this pattern matters for Claude Code**:
- Claude Code has **deferred tool loading** — tools not in the initial set are discoverable but their descriptions aren't always visible
- By putting critical rule summaries IN the tool description, they survive deferred loading and are always in the agent's awareness
- Full content via resources avoids bloating the context with complete documents

**Confidence**: High — verified no existing project implements this exact dual-channel pattern.

---

## Part 3: Recommendations

### For Shell Scripts as Tools

| Need | Recommendation | Why |
|:-----|:--------------|:----|
| **Structured, secure shell tools** | MCPShell | YAML config, CEL constraints, sandboxing |
| **Quick prototyping** | mcptools proxy | One-liner tool registration |
| **Auto-discovery from directory** | Build custom (use mcp-framework as base) | No existing solution does this |
| **TypeScript-first with auto-discovery** | mcp-framework | Directory-based discovery, but TS only |

### For Structured Documents as Tools + Resources

| Need | Recommendation | Why |
|:-----|:--------------|:----|
| **Rules with frontmatter, tag filtering** | rules-mcp | Closest to the content model needed |
| **Markdown knowledge base** | library-mcp | Good retrieval API, Will Larson's design |
| **Dual-channel (descriptions + resources)** | Build custom | Nothing exists for this exact pattern |
| **External docs search** | docs-mcp-server | Overkill for internal rules but powerful |

### For agent-team Specifically

**Short term**: Use MCPShell to expose team management scripts as MCP tools. Use rules-mcp to serve team behavior docs.

**Medium term**: Build a custom MCP server (likely in TypeScript using mcp-framework) that:
1. Auto-discovers shell scripts from a `tools/` directory (parsing frontmatter comments for schemas)
2. Auto-discovers markdown documents from a `docs/` directory (putting summaries in tool descriptions, full content as resources)
3. Combines both in a single server

This would be a novel contribution to the MCP ecosystem — no existing project does both.

---

## Open Questions

1. **Should the custom server be part of agent-team or a standalone MCP server?** A standalone server (e.g., `mcp-scripts-and-docs`) would have broader utility.
2. **What's the right frontmatter format for shell scripts?** MCPShell uses YAML config files alongside scripts. An alternative is comments-in-script (like JSDoc for bash).
3. **How should the dual-channel server handle rule updates?** Watch the filesystem? Reload on demand? Cache with TTL?
4. **Is mcp-framework the right base, or should it be built from scratch on the MCP SDK?** mcp-framework adds auto-discovery but also adds TypeScript compilation overhead.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| MCPShell is the most feature-complete shell-to-MCP solution | High |
| mcptools proxy is the quickest shell-to-MCP setup | High |
| No existing project auto-discovers scripts from a directory | High |
| rules-mcp is the closest to the document serving pattern | High |
| No existing project implements dual-channel (tool descriptions + resources) | High |
| mcp-framework provides directory-based auto-discovery (for TS) | High |
| claude-critical-rules-mcp demonstrates the "rules in tool descriptions" pattern | High |
| Building a custom dual-channel server would be novel | High |

## Sources

- [MCPShell (inercia)](https://github.com/inercia/MCPShell) — YAML-configured shell scripts as MCP tools with CEL constraints
- [MCPShell on mcp.so](https://mcp.so/server/mcpshell/inercia) — detailed configuration examples
- [mcptools (f/mcptools)](https://github.com/f/mcptools) — CLI with proxy mode for registering scripts as tools
- [mcptools README](https://github.com/f/mcptools/blob/master/README.md) — proxy tool add_operation syntax
- [mcp-framework (QuantGeekDev)](https://github.com/QuantGeekDev/mcp-framework) — TypeScript MCP framework with auto-discovery
- [rules-mcp](https://github.com/rules-mcp/rules-mcp) — Markdown rules with frontmatter served via MCP
- [MCPRules (bartwisch)](https://github.com/bartwisch/MCPRules) — Category-based programming guidelines server
- [claude-critical-rules-mcp (optimaquantum)](https://github.com/optimaquantum/claude-critical-rules-mcp) — 21-rule enforcement via MCP tools
- [library-mcp (lethain)](https://github.com/lethain/library-mcp) — Markdown knowledge base MCP server
- [library-mcp blog post](https://lethain.com/library-mcp/) — Will Larson's design rationale
- [docs-mcp-server (arabold)](https://github.com/arabold/docs-mcp-server) — Documentation scraping and search
- [agent-rules-mcp (4regab)](https://github.com/4regab/agent-rules-mcp) — GitHub repo rules via MCP
- [@mako10k/mcp-shell-server (npm)](https://www.npmjs.com/package/@mako10k/mcp-shell-server) — Configurable shell execution
- [tumf/mcp-shell-server](https://github.com/tumf/mcp-shell-server) — Allowlist-based shell execution
- [mkusaka/mcp-shell-server](https://github.com/mkusaka/mcp-shell-server) — Multi-shell support
- [sonirico/mcp-shell](https://github.com/sonirico/mcp-shell) — Auditable shell command execution
