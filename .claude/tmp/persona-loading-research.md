# Persona Loading into Claude Code Agent System Prompts

**Research Date:** 2026-02-15  
**Research Goal:** Determine how to load persona/character files into a Claude Code agent's SYSTEM PROMPT (not conversation context), with each agent getting ONLY their own persona.

---

## Executive Summary

After reviewing official Claude Code documentation for sub-agents, skills, and hooks, here are the key findings:

1. **`!`command`` syntax works ONLY in skills**, not in agent markdown files
2. **Agent file body IS the system prompt** - inline content is the simplest solution
3. **SessionStart hooks can inject system prompt content** via `additionalContext`
4. **Skills preloading injects into context, NOT system prompt**
5. **Task tool's `prompt` goes to conversation context**, not system prompt
6. **CLAUDE.md is inherited by all agents** - conditional content would work but wastes tokens

---

## Question 1: Does `!`command`` syntax work in agent files?

**Answer: NO** - The `!`command`` syntax works ONLY in skills, NOT in agent markdown files.

### Evidence

From the official skills documentation:

> "The `!`command\`\` syntax runs shell commands before the skill content is sent to Claude. The command output replaces the placeholder, so Claude receives actual data, not the command itself."

This feature is explicitly described in the [skills documentation](https://code.claude.com/docs/en/skills#inject-dynamic-context) under "Inject dynamic context," and there is NO mention of this feature in the [sub-agents documentation](https://code.claude.com/docs/en/sub-agents).

### Additional Context

According to [365i Web Design's article on Dynamic Context Injection](https://www.365iwebdesign.co.uk/news/2026/01/29/how-to-use-dynamic-context-injection-claude-code/):

> "Dynamic Context Injection lets Claude Code skills automatically inject live project data (git status, build outputs, test results, file listings) into your prompts before Claude sees them."

This feature is specifically a **skills feature**, not an agent feature.

### Conclusion

If you put `!`cat .claude/personas/coach.md`` in an agent .md file body, it will NOT execute. The command would appear as literal text in the system prompt.

---

## Question 2: Can agent-specific hooks inject content into the system prompt?

**Answer: YES** - SessionStart hooks can inject content via `additionalContext`, but with caveats.

### Evidence

From the [hooks reference documentation](https://code.claude.com/docs/en/hooks#sessionstart-decision-control):

> "Any text your hook script prints to stdout is added as context for Claude. In addition to the JSON output fields available to all hooks, you can return these event-specific fields:
> 
> | Field               | Description                                                               |
> | :------------------ | :------------------------------------------------------------------------ |
> | `additionalContext` | String added to Claude's context. Multiple hooks' values are concatenated |"

### How it works

SessionStart hooks receive an `agent_type` field when Claude Code starts with `claude --agent <name>`:

```json
{
  "session_id": "abc123",
  "source": "startup",
  "model": "claude-sonnet-4-5-20250929",
  "agent_type": "coach"  // ← Only present when launched with --agent flag
}
```

A SessionStart hook could:
1. Check if `agent_type` is present
2. Read the corresponding persona file from `.claude/personas/<agent_type>.md`
3. Return the content via `additionalContext`

### Example Implementation

```bash
#!/bin/bash
# .claude/hooks/load-persona.sh

INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')

if [ -z "$AGENT_TYPE" ]; then
  exit 0  # No agent type, skip
fi

PERSONA_FILE="$CLAUDE_PROJECT_DIR/.claude/personas/${AGENT_TYPE}.md"

if [ -f "$PERSONA_FILE" ]; then
  PERSONA_CONTENT=$(cat "$PERSONA_FILE")
  
  jq -n --arg content "$PERSONA_CONTENT" '{
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: $content
    }
  }'
else
  exit 0  # No persona file found
fi
```

### Caveats

1. **SessionStart hooks run on EVERY session start** (new, resume, clear, compact) - performance matters
2. **Hook content goes to "context" not explicitly "system prompt"** - the docs don't clarify if this is persistent or compactable
3. **Requires the agent to be launched with `--agent` flag** - the `agent_type` field is only present in that scenario
4. **No way to scope hooks to specific agents** - the hook runs for ALL agents, so it must check `agent_type` internally

### Tradeoffs

✅ **Pros:**
- Keeps persona files separate and maintainable
- Dynamic - persona file can be updated without touching agent files
- Works with existing Claude Code hook system

❌ **Cons:**
- Adds complexity (hook script, JSON parsing)
- SessionStart fires frequently (every resume, compact, etc.)
- Unclear if `additionalContext` persists through compaction
- Only works when launching with `--agent` flag

---

## Question 3: Can the team-lead inject persona content at launch time?

**Answer: PARTIALLY** - The Task tool's `prompt` parameter goes to conversation context, NOT system prompt.

### Evidence

From the [sub-agents documentation](https://code.claude.com/docs/en/sub-agents#pretooluse-input), the Task tool's input schema is:

```typescript
{
  "prompt": string,        // "The task for the agent to perform"
  "description": string,   // "Short description of the task"
  "subagent_type": string, // "Type of specialized agent to use"
  "model": string          // "Optional model alias to override the default"
}
```

The documentation states:

> "The `prompt` field is the task for the agent to perform."

This goes into the **conversation as the initial user message**, NOT into the system prompt.

### How spawning works

When a teammate is spawned via the Task tool:
1. The `subagent_type` determines which `.claude/agents/<name>.md` file to load
2. That agent's markdown body becomes the **system prompt**
3. The Task tool's `prompt` becomes the **first user message** in the conversation

### Example

If the orchestrator does:

```typescript
Task({
  subagent_type: "coach",
  prompt: "You are Coach. " + <persona content> + " Now help the user with X."
})
```

The subagent receives:
- **System prompt:** Content from `.claude/agents/coach.md`
- **First user message:** "You are Coach. <persona content> Now help the user with X."

### Implications

This is NOT what we want because:
- The persona is in **conversation context** (gets compacted away)
- It's NOT in the **system prompt** (which persists)
- The orchestrator would need to re-inject the persona on every Task invocation

### Conclusion

This approach does NOT meet the requirement of loading persona content into the system prompt.

---

## Question 4: CLAUDE.md @reference with agent-conditional content

**Answer: WORKS, but wasteful** - Agents inherit CLAUDE.md, so conditional content would load all personas for every agent.

### Evidence

From the [sub-agents documentation](https://code.claude.com/docs/en/sub-agents#run-skills-in-a-subagent):

> "With `context: fork`, you write the task in your skill and pick an agent type to execute it. For the inverse (defining a custom subagent that uses skills as reference material), see Subagents."

And from the skills documentation:

> "Skills and subagents work together in two directions... Also loads: CLAUDE.md"

This confirms that **agents inherit CLAUDE.md content**.

### How it would work

Put all personas in a single file:

```markdown
# .claude/personas/all-personas.md

## If you are coach
You are Coach, a supportive mentor who...

## If you are analyst
You are Analyst, a data-driven investigator who...

## If you are implementer
You are Implementer, a pragmatic builder who...
```

Reference it from CLAUDE.md:

```markdown
# CLAUDE.md

## Agent Personas

@.claude/personas/all-personas.md
```

### Problems

1. **All agents load ALL personas** - every agent sees all personas in their context
2. **Token waste** - if you have 10 personas at 500 tokens each, that's 5000 tokens loaded for every agent, when each only needs 500
3. **Unreliable filtering** - the agent might not reliably ignore sections not meant for it
4. **Scales poorly** - as you add more personas, the waste multiplies

### Conclusion

This approach **technically works** but is highly inefficient and doesn't scale.

---

## Question 5: Agent file body IS the system prompt

**Answer: YES** - This is the simplest and most direct solution.

### Evidence

From the [sub-agents documentation](https://code.claude.com/docs/en/sub-agents#write-subagent-files):

> "Subagent files use YAML frontmatter for configuration, followed by the system prompt in Markdown...
> 
> The frontmatter defines the subagent's metadata and configuration. **The body becomes the system prompt** that guides the subagent's behavior. Subagents receive only this system prompt (plus basic environment details like working directory), not the full Claude Code system prompt."

### How it works

The markdown body of `.claude/agents/<name>.md` IS the agent's system prompt directly.

Example:

```markdown
---
name: coach
description: A supportive mentor who guides the user
model: sonnet
---

You are Coach, a supportive and encouraging mentor.

Your role is to:
- Guide the user through challenges with patience
- Ask clarifying questions to understand their goals
- Provide constructive feedback without judgment
- Celebrate progress and milestones

When responding:
- Use an encouraging, warm tone
- Break down complex problems into manageable steps
- Acknowledge effort and learning, not just results
```

The entire markdown body becomes the system prompt. No indirection, no hooks, no injection - just pure content.

### Tradeoffs

✅ **Pros:**
- **Simple and direct** - no magic, no indirection
- **Guaranteed to work** - the body IS the system prompt by design
- **No token waste** - each agent loads ONLY its own content
- **Easy to test** - just edit the file and restart
- **Fast** - no runtime processing or hook execution

❌ **Cons:**
- **File length** - personas might make agent files long (but docs say this is fine)
- **Duplication** - if multiple agents share common instructions, those get repeated
- **Maintainability** - changing shared guidance requires editing multiple files

### Best Practices

The documentation suggests:

> "Keep `SKILL.md` under 500 lines. Move detailed reference material to separate files."

But there's no similar warning for agent files. The example agents in the docs range from ~10-40 lines, but there's no stated limit.

### Conclusion

This is the **recommended approach**. It's simple, reliable, and follows Claude Code's design.

---

## Question 6: Skills preloading

**Answer: NO** - Preloaded skills inject into context, NOT system prompt.

### Evidence

From the [sub-agents documentation](https://code.claude.com/docs/en/sub-agents#preload-skills-into-subagents):

> "Use the `skills` field to inject skill content into a subagent's context at startup. This gives the subagent domain knowledge without requiring it to discover and load skills during execution...
> 
> The **full content of each skill is injected into the subagent's context**, not just made available for invocation."

The key phrase is "**injected into the subagent's context**" - this means conversation context, NOT system prompt.

### How it works

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions and patterns from the preloaded skills.
```

The skills are loaded into **context** (compactable), while the agent markdown body is the **system prompt** (persistent).

### Implications

If you made each persona a skill and preloaded it:

```yaml
---
name: coach
skills:
  - persona-coach
---
```

The persona content would be in **context** (not system prompt), so:
- It would get compacted away over time
- It's not persistent like the system prompt
- The agent might "forget" its persona after compaction

### Conclusion

This approach does NOT meet the requirement of loading persona content into the system prompt.

---

## Question 7: Any other mechanism

**Answer: NO** - There are no other documented ways to dynamically inject file content into an agent's system prompt.

### Mechanisms Explored

1. ❌ **`!`command`` in agent files** - Only works in skills
2. ✅ **SessionStart hooks** - Can inject via `additionalContext`, but unclear if it's persistent
3. ❌ **Task tool `prompt` parameter** - Goes to conversation, not system prompt
4. ⚠️ **CLAUDE.md reference** - Works but loads all personas for every agent (wasteful)
5. ✅ **Inline in agent file body** - Direct and guaranteed to work
6. ❌ **Skills preloading** - Injects into context, not system prompt

### Other Possibilities (Not Documented)

The following are NOT documented and should be considered speculative:

- **Environment variable substitution in agent files?** - No evidence in docs
- **Jinja/template syntax in agent files?** - No evidence in docs
- **Plugin-provided agent system prompt injection?** - No evidence in docs

---

## Recommended Approach

Based on the research, here are the recommended approaches in priority order:

### Option 1: Inline Persona Content (Recommended)

**How:** Put the persona content directly in the agent file body.

**File structure:**
```
.claude/
├── agents/
│   ├── coach.md
│   ├── analyst.md
│   └── implementer.md
└── personas/
    ├── coach.md           # ← Reference copy for documentation
    ├── analyst.md
    └── implementer.md
```

**Agent file:**
```markdown
---
name: coach
description: A supportive mentor who guides the user
model: sonnet
---

You are Coach, a supportive and encouraging mentor.

[Full persona content here]
```

**Pros:**
- Simple and reliable
- No runtime processing
- Guaranteed to be in system prompt
- Each agent loads ONLY its content

**Cons:**
- File length (but no documented limit)
- Duplication if personas share content

**When to use:** Default choice for most cases.

---

### Option 2: SessionStart Hook Injection

**How:** Use a SessionStart hook to read persona files and inject them via `additionalContext`.

**File structure:**
```
.claude/
├── agents/
│   ├── coach.md           # ← Minimal agent definition
│   ├── analyst.md
│   └── implementer.md
├── personas/
│   ├── coach.md           # ← Persona content here
│   ├── analyst.md
│   └── implementer.md
└── hooks/
    └── load-persona.sh    # ← Hook script
```

**Hook configuration:**
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/load-persona.sh"
          }
        ]
      }
    ]
  }
}
```

**Pros:**
- Persona files are separate (easier to maintain)
- Can be dynamically updated without touching agent files

**Cons:**
- More complex (hook script, JSON parsing)
- Runs on every session start (performance concern)
- Unclear if `additionalContext` persists through compaction
- Only works when launching with `--agent` flag

**When to use:** When you need to dynamically load/update personas at runtime, or when you have many shared instructions that would otherwise be duplicated.

---

### Option 3: Hybrid Approach

**How:** Put the core persona in the agent file body, use hooks for dynamic context.

**Agent file:**
```markdown
---
name: coach
description: A supportive mentor who guides the user
model: sonnet
---

You are Coach, a supportive and encouraging mentor.

[Core persona traits here - ~100-200 lines]

Additional dynamic context will be provided via SessionStart hooks.
```

**Hook:** Loads supplementary information (recent feedback, user preferences, etc.)

**Pros:**
- Core persona is guaranteed to be in system prompt
- Dynamic context can be updated without restarting
- Balances simplicity and flexibility

**Cons:**
- Split responsibility between file and hook
- Still requires hook complexity for dynamic parts

**When to use:** When you have stable core persona traits but need dynamic runtime context.

---

## Sources

- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [How to Use Dynamic Context Injection in Claude Code | 365i](https://www.365iwebdesign.co.uk/news/2026/01/29/how-to-use-dynamic-context-injection-claude-code/)
- [Claude Code Dynamic Context Injection: The Hidden Power Feature | 365i](https://www.365iwebdesign.co.uk/news/2026/01/23/claude-code-dynamic-context-injection/)
- [How to Use Claude Code: A Guide to Slash Commands, Agents, Skills, and Plug-ins](https://www.producttalk.org/how-to-use-claude-code-features/)
- [A Guide to Claude Code 2.0 and getting better at using coding agents | sankalp's blog](https://sankalp.bearblog.dev/my-experience-with-claude-code-20-and-how-to-get-better-at-using-coding-agents/)

---

## Conclusion

**Direct answer:** Inline the persona content in each agent's markdown file body. This is the simplest, most reliable approach that meets all requirements.

If you need maintainability or dynamic loading, use SessionStart hooks with `additionalContext`, but be aware of the performance and persistence considerations.
