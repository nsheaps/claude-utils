# Behavior Correction: Artifact Linking in Completion Reports

**Date**: 2026-02-17
**Commit**: `5cd0f0a1` in `nsheaps/ai-mktpl`
**File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/artifact-linking-in-reports.md`

## Summary

Created a new rule requiring that every task completion report includes links to all produced artifacts (GitHub issues, file paths, commit hashes, PR links, branches). The rule applies to direct task completions, sub-agent summaries relayed by orchestrators, and any status update referencing completed work. Includes good/bad examples for both direct reports and team-lead relay scenarios.
