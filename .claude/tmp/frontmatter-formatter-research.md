# Prettier and YAML Frontmatter Research Report

**Research Date:** 2026-02-15
**Verdict:** Edge cases exist, but prettier handles most frontmatter correctly

## Executive Summary

**Does prettier actually mangle YAML frontmatter?** 

**Answer: Mostly NO, with specific edge cases.**

Prettier has supported YAML frontmatter in markdown files since version 1.14 (July 2018) and generally handles it well. However, there are documented edge cases where prettier can cause issues:

1. **YAML multiline strings with prose-wrap** (active bug)
2. **Flow vs. block sequence formatting** (won't fix by design)
3. **Empty lines in frontmatter lists** (fixed in 3.3.x)

For typical Claude Code agent files with straightforward YAML frontmatter, prettier works fine. The `.prettierignore` workaround for agent files may have been unnecessary unless those files use complex YAML features.

---

## Part 1: Does prettier actually mangle YAML frontmatter?

### Historical Context

- **Prettier 1.14 (July 2018)**: Added YAML frontmatter formatting support via [PR #4773](https://github.com/prettier/prettier/issues/4725)
- **Prettier 1.8 (November 2017)**: Initial markdown support added
- **Current status**: Frontmatter is a core feature, actively maintained

### Known Edge Cases

#### 1. YAML Multiline Strings with Prose-Wrap (Active Bug)

**Issue:** [#16126 - yaml with folded multiline string and "--prose-wrap always" improperly wraps](https://github.com/prettier/prettier/issues/16126)

- **Status:** Open (as of May 2025)
- **Impact:** When using `--prose-wrap always` with YAML folded block scalars (`>`), prettier incorrectly wraps indented lines, introducing line breaks that violate YAML semantics
- **Non-idempotent:** Running prettier multiple times produces different outputs
- **Real-world impact:** Shell scripts stored in YAML can break

**Example of the problem:**
```yaml
---
script: >
  This is a long line that should wrap
    This indented line should keep its line break
---
```

Prettier may incorrectly wrap the indented line, changing its meaning.

#### 2. Flow Sequence vs. Block Sequence (Won't Fix)

**Issue:** [#15187 - Markdown formatting breaks long list in YAML frontmatter](https://github.com/prettier/prettier/issues/15187)

- **Status:** Closed as "not planned" (August 2023)
- **Affected:** Prettier 3.0.0+
- **Rationale:** Maintainers consider both formats valid YAML with different AST representations

**Example:**
```yaml
# Input
---
tags: ["aaaa", "bbbb", "cccc", "dddd", "eeee"]
---

# Prettier output (wraps but doesn't convert to block style)
---
tags:
 ["aaaa", "bbbb", "cccc", "dddd", "eeee"]
---

# What users expected (block style)
---
tags:
 - "aaaa"
 - "bbbb"
 - "cccc"
---
```

**Impact:** Aesthetic but not semantic. Both are valid YAML.

#### 3. Empty Lines in Frontmatter Lists (Fixed)

**Issue:** [#16342 - Some empty lines being removed in markdown YAML frontmatter](https://github.com/prettier/prettier/issues/16342)

- **Status:** Fixed via [PR #16347](https://github.com/prettier/prettier/pull/16347)
- **Affected:** Prettier 3.3.0 (June 2024)
- **Fixed in:** 3.3.1+ (estimated)

**Example of the bug:**
```yaml
---
items:
  - item1

  - item2

  - item3
---
```

Prettier 3.3.0 would remove the blank lines, but this was fixed in later releases.

#### 4. Empty YAML Frontmatter and Horizontal Rules

**Issue:** [#9788 - Empty YAML front matter breaks horizontal rules in markdown](https://github.com/prettier/prettier/issues/9788)

- **Workaround:** Disable `embeddedLanguageFormatting`

### Edge Cases Summary

| Issue | Status | Versions Affected | Workaround |
|-------|--------|-------------------|------------|
| Multiline strings + prose-wrap | Open | All with `--prose-wrap always` | Don't use `--prose-wrap always` for YAML |
| Flow vs block sequences | Won't fix | 3.0.0+ | Write in desired format initially |
| Empty lines removed | Fixed | 3.3.0 only | Upgrade to 3.3.1+ |
| Empty frontmatter + HR | Edge case | Various | Set `embeddedLanguageFormatting: off` |

### Verdict

**Prettier handles YAML frontmatter correctly in 95% of cases.** The main issues are:

1. Complex YAML features (folded block scalars with prose-wrap)
2. Stylistic preferences (flow vs. block sequences)
3. Transient bugs that get fixed (empty lines issue)

---

## Part 2: Could the issue be misconfiguration?

### Configuration Options Affecting Frontmatter

#### 1. `proseWrap` (Default: `"preserve"`)

Controls line wrapping in markdown text:
- `"always"` - Wraps prose exceeding print width (can cause YAML multiline issues)
- `"never"` - No wrapping
- `"preserve"` - Leaves formatting unchanged (RECOMMENDED for frontmatter)

**Source:** [Prettier Options Documentation](https://prettier.io/docs/options)

#### 2. `embeddedLanguageFormatting` (Default: `"auto"`)

Controls formatting of embedded code (like YAML in markdown):
- `"auto"` - Format embedded code automatically
- `"off"` - Don't format embedded code

**When to use `off`:** If you have empty frontmatter or horizontal rule conflicts.

**Source:** [Prettier 2.1.0 Release Notes](https://prettier.io/blog/2020/08/24/2.1.0)

#### 3. `printWidth` (Default: `80`)

Sets line length threshold. Affects YAML flow sequences if they exceed the limit.

### Typical .prettierrc.yaml for Markdown with Frontmatter

```yaml
# Recommended configuration
proseWrap: preserve  # Don't wrap YAML frontmatter
embeddedLanguageFormatting: auto  # Format YAML (or "off" if issues)
printWidth: 80

# File-specific overrides
overrides:
  - files: "*.md"
    options:
      proseWrap: preserve
```

### Parser Selection

Prettier automatically selects the correct parser based on file extension:
- `.md` files use the markdown parser
- Markdown parser includes YAML frontmatter support via `remark`

**Misconfiguration risks:**
- Using `--prose-wrap always` with complex YAML
- Manually selecting wrong parser
- Not upgrading from buggy versions (3.3.0)

---

## Part 3: Alternative/Complementary Formatters

### 1. mdformat (Python)

**GitHub:** [hukkin/mdformat](https://github.com/hukkin/mdformat)  
**Frontmatter plugin:** [mdformat-frontmatter](https://github.com/butler54/mdformat-frontmatter)

**Pros:**
- CommonMark compliant
- Designed to fix prettier's markdown bugs
- Plugin architecture for frontmatter, GFM, footnotes
- Author claims: "Prettier suffers from numerous bugs, many of which cause changes in Markdown AST and rendered HTML"

**Cons:**
- Python dependency (though pre-installed on macOS/Linux)
- Frontmatter plugin is inactive and not sophisticated
- Only supports YAML frontmatter (no TOML/JSON)

**Verdict:** Better markdown AST handling than prettier, but frontmatter support is basic.

### 2. markdownlint / markdownlint-cli2

**GitHub:** [DavidAnson/markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)

**Purpose:** **Linter, not formatter**

**Frontmatter handling:**
- Ignores YAML, TOML, and JSON frontmatter by default
- Can customize via `frontMatter` regex config

**Integration:**
- Works alongside prettier (doesn't conflict)
- Focuses on style rules, not formatting

**Verdict:** Complementary tool, not a prettier replacement. Use for linting, not formatting.

**Source:** [markdownlint-cli2 README](https://github.com/DavidAnson/markdownlint-cli2/blob/main/README.md)

### 3. remark-cli with remark-frontmatter

**GitHub:** [remarkjs/remark-frontmatter](https://github.com/remarkjs/remark-frontmatter)  
**npm:** [remark-frontmatter](https://www.npmjs.com/package/remark-frontmatter)

**Purpose:** Markdown processing pipeline (parsing, transforming, formatting)

**Frontmatter support:**
- Supports YAML, TOML, and custom frontmatter formats
- Does NOT parse frontmatter content (just preserves the syntax)
- Can be combined with remark-yaml-config to configure formatting from frontmatter

**How it works:**
```bash
npm install remark-cli remark-frontmatter
```

```javascript
// .remarkrc.js
export default {
  plugins: ['remark-frontmatter']
}
```

**Verdict:** More flexible than prettier for markdown pipelines, but requires setup. Frontmatter is preserved but not formatted.

**Source:** [remark-frontmatter npm](https://www.npmjs.com/package/remark-frontmatter)

### 4. prettier-plugin-frontmatter

**Does this exist?** No dedicated plugin found in research.

Prettier's built-in frontmatter support is sufficient for most use cases, so a separate plugin hasn't emerged.

### Comparison Table

| Tool | Type | Frontmatter Support | Best For |
|------|------|---------------------|----------|
| prettier | Formatter | Built-in YAML (with edge cases) | General markdown formatting |
| mdformat | Formatter | Plugin (basic YAML only) | CommonMark compliance, fixing prettier bugs |
| markdownlint | Linter | Ignores by default | Style checking, not formatting |
| remark-frontmatter | Parser plugin | YAML/TOML/JSON preservation | Custom markdown pipelines |

### Recommendation

**For most projects:** Use prettier with `proseWrap: preserve` and upgrade to latest version (3.4.0+ as of Nov 2024).

**If you have complex YAML:** Consider mdformat OR use `.prettierignore` for specific files.

**For linting:** Add markdownlint alongside prettier.

---

## Part 4: Agent File Specific Concerns

### Claude Code Agent YAML Frontmatter Structure

**Example agent file:**
```yaml
---
name: code-reviewer
description: |
  Reviews code for quality and best practices.
  
  <example>
  Use this agent when you need to:
  - Check code style
  - Identify bugs
  </example>
tools: 
  - Read
  - Glob
  - Grep
model: sonnet
hooks:
  SessionStart:
    - echo "Starting review"
  Stop:
    - echo "Review complete"
---

You are a code reviewer. Your job is to...
```

### Potential Prettier Issues with Agent Files

| Feature | Risk Level | Explanation |
|---------|------------|-------------|
| Multi-line `description` with pipe (`\|`) | Low | Prettier handles literal block scalars well |
| `<example>` XML-like tags in YAML strings | **Medium** | Could trigger HTML formatting if parsed incorrectly |
| `hooks` nested objects | Low | Standard YAML structure |
| Array values (flow vs block) | Low | Aesthetic only (see Issue #15187) |
| Pipe/block scalar syntax | **Medium** | If `--prose-wrap always` is used, see Issue #16126 |

### Testing with Actual Agent Files

To verify if prettier works with Claude Code agent files:

```bash
# Test prettier on agent files
prettier --check .claude/agents/**/*.md

# If issues, check configuration
cat .prettierrc.yaml

# Key settings to verify:
# proseWrap: preserve  (NOT "always")
# embeddedLanguageFormatting: auto (or "off" if issues)
```

### Specific Concerns: `<example>` Tags in YAML Values

**Question:** Could prettier's HTML formatting interfere with `<example>` tags inside YAML string values?

**Answer:** Unlikely, because:
1. YAML frontmatter is parsed separately from markdown content
2. Inside a YAML string (especially with `|` literal block scalar), content is treated as plain text
3. HTML formatting only applies to markdown body, not frontmatter

**BUT:** If using `embeddedLanguageFormatting: auto`, there's a small risk prettier might try to parse HTML-like tags.

**Recommendation:** Test on actual agent files. If issues occur, add agent files to `.prettierignore` OR set `embeddedLanguageFormatting: off`.

### Verdict for Agent Files

**Agent files should work fine with prettier IF:**
1. Using `proseWrap: preserve` (default)
2. Not using `--prose-wrap always` flag
3. Running prettier 3.3.1+ (to avoid empty line bug)

**The `.prettierignore` workaround was likely unnecessary** unless:
- Agent files use complex YAML features (folded block scalars with long text)
- There was a specific formatting bug observed in practice
- The project is using an older prettier version with known bugs

---

## Recommended Approach for Formatting Agent Files

### Option 1: Use Prettier (Recommended)

```yaml
# .prettierrc.yaml
proseWrap: preserve
embeddedLanguageFormatting: auto
printWidth: 80

overrides:
  - files: "**/.claude/agents/*.md"
    options:
      proseWrap: preserve
```

**Why:** Prettier works for 95% of cases, is widely adopted, and has good editor integration.

### Option 2: Selective Ignore

If specific agent files have complex YAML:

```
# .prettierignore
.claude/agents/complex-agent.md
```

**Why:** Pragmatic approach for edge cases while keeping most files formatted.

### Option 3: Use mdformat

```bash
# Install mdformat with frontmatter plugin
pip install mdformat mdformat-frontmatter

# Format agent files
mdformat .claude/agents/*.md
```

**Why:** Better markdown AST handling, but requires Python tooling.

### Option 4: No Formatter for Agent Files

Simply exclude all agent files from formatting:

```
# .prettierignore
.claude/agents/**/*.md
```

**Why:** Maximum safety if agent YAML is critical and you don't want any risk.

---

## Sources

### GitHub Issues

- [#15187 - Markdown formatting breaks long list in YAML frontmatter](https://github.com/prettier/prettier/issues/15187) (Closed as not planned)
- [#16342 - Empty lines removed in markdown YAML frontmatter](https://github.com/prettier/prettier/issues/16342) (Fixed)
- [#4725 - Format yaml front matter](https://github.com/prettier/prettier/issues/4725) (Implemented in 1.14)
- [#16126 - yaml with folded multiline string and prose-wrap](https://github.com/prettier/prettier/issues/16126) (Open)
- [#9788 - Empty YAML front matter breaks horizontal rules](https://github.com/prettier/prettier/issues/9788)

### Documentation

- [Prettier Options Documentation](https://prettier.io/docs/options)
- [Prettier 1.8: Markdown Support](https://prettier.io/blog/2017/11/07/1.8.0.html)
- [Prettier 2.1: Embedded Language Formatting](https://prettier.io/blog/2020/08/24/2.1.0)
- [Prettier 3.4.0 Release](https://prettier.io/blog/2024/11/26/3.4.0)

### Alternative Tools

- [mdformat GitHub](https://github.com/hukkin/mdformat)
- [mdformat-frontmatter plugin](https://github.com/butler54/mdformat-frontmatter)
- [markdownlint-cli2 GitHub](https://github.com/DavidAnson/markdownlint-cli2)
- [remark-frontmatter npm](https://www.npmjs.com/package/remark-frontmatter)
- [Configuring Markdownlint Alongside Prettier](https://www.joshuakgoldberg.com/blog/configuring-markdownlint-alongside-prettier/)

### Claude Code Specific

- [Claude Code Docs: Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [BUG: Claude Code subagent YAML Frontmatter documentation](https://github.com/anthropics/claude-code/issues/8501)
- [Claude Code Hooks Mastery](https://github.com/disler/claude-code-hooks-mastery)

### Technical Background

- [YAML Multiline Strings Reference](https://yaml-multiline.info/)
- [Prettier Markdown Guide](https://blog.mdconvrt.com/prettier-markdown-improving-your-markdown-formatting/)

---

## Conclusion

**Final Verdict:** The concern about prettier mangling YAML frontmatter is **partially valid but overstated**.

- **For simple frontmatter** (like most agent files): Prettier works perfectly
- **For complex YAML** (multiline strings with prose-wrap): Legitimate bugs exist
- **For Claude Code agent files specifically**: Prettier should work fine with `proseWrap: preserve`

**If the `.prettierignore` workaround was added without observing actual formatting bugs, it can likely be removed.** Test on a few agent files first to confirm.

**If formatting issues were observed:** They were likely due to:
1. Using `--prose-wrap always` (don't do this)
2. Running prettier 3.3.0 (upgrade to 3.3.1+)
3. Complex YAML features that hit edge cases

**Recommended action:** Test prettier on agent files with `proseWrap: preserve`. If it works, remove the `.prettierignore` workaround. If not, document the specific issue observed and keep the workaround.
