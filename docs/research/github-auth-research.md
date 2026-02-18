# Research: GitHub Auth Patterns for Agent Identity

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: How can AI agents running locally (as tmux panes with Claude Code) get distinct GitHub identities?

## Executive Summary

There are several viable approaches for giving AI agents distinct GitHub identities, each with different trade-offs. The most promising approaches are:

1. **GitHub Apps (one app per agent or one app with metadata)** -- provides true bot identity (`app-name[bot]`), verified commits via API, short-lived tokens, and full separation from the user. Can be created privately for personal use. This is the gold standard used by Dependabot, Renovate, and GitHub Actions.

2. **Git author/committer split** -- the simplest approach. Set `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL` per-agent while keeping the user as committer. GitHub does NOT verify author email, so any value works. GitHub displays both author and committer in the UI. Zero infrastructure cost.

3. **Machine user accounts** -- dedicated GitHub user accounts for bots. GitHub explicitly permits this. Each consumes a free-tier account but provides full identity separation (SSH keys, tokens, etc.). Billing: free for public repos, each account counts as a seat in paid orgs.

4. **Co-authored-by trailers** -- already used by Claude Code. GitHub renders these in the UI and counts them as contributions. Best used in combination with other approaches, not as primary identity.

The user's interest in "user OAuth with agent metadata" is the most constrained path: OAuth user tokens always attribute actions to the user, with no standard mechanism for agent-level metadata in the API.

## 1. GitHub Apps

### How Installation Tokens Work

GitHub Apps authenticate in two phases:
1. **JWT authentication** -- The app generates a JWT signed with its private key (PEM file), using the App's Client ID. Valid for 10 minutes.
2. **Installation access token** -- Exchange the JWT for an installation token via `POST /app/installations/{id}/access_tokens`. Token is valid for **1 hour**.

The Octokit SDK handles JWT generation and token refresh automatically.

### Agent Identity with GitHub Apps

Each GitHub App gets a dedicated bot identity:
- Username: `app-slug[bot]`
- Email: `{BOT_USER_ID}+app-slug[bot]@users.noreply.github.com`
- User ID: Available at `https://api.github.com/users/app-slug[bot]`

When the installation token is used for API-based commits (via the Commits API), commits appear as **verified** and authored by the bot. This is how Dependabot and GitHub Actions achieve verified bot commits.

### Can You Create a Private App?

Yes. Any GitHub user can create a GitHub App under their personal account or organization:
- Go to Settings > Developer Settings > GitHub Apps
- The app can be marked as **private** (not listed on the Marketplace)
- Install it only on your own account/repos
- No approval process needed for private apps

### Multiple Agents, Multiple Apps?

You could create one app per agent (e.g., `claude-engineer[bot]`, `claude-researcher[bot]`), each with its own:
- Private key (PEM file)
- Bot identity
- Permission scope

However, each app requires its own registration and key management. A simpler approach: **one app with per-agent metadata** in commit messages (e.g., agent name in the commit body or trailers).

### Commits via API vs Git CLI

**Important distinction:**
- Commits made via **GitHub's REST API** using an installation token get **verified** badges automatically -- GitHub recognizes the token and signs the commit.
- Commits made via **git CLI** (push over HTTPS using the installation token as password) do NOT get verified badges. The token authenticates the push but doesn't sign commits.

For verified bot commits via git CLI, you would need GPG signing with a key registered to the bot account, which is not straightforward for App bot accounts.

### References
- [Generating installation access tokens - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [Authenticating as a GitHub App installation - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [How to Use Commit Signing with GitHub Apps - Community Discussion #50055](https://github.com/orgs/community/discussions/50055)
- [verified-bot-commit GitHub Action](https://github.com/IAreKyleW00t/verified-bot-commit)

## 2. OAuth Device Flow

### How It Works

The OAuth device flow is designed for headless/CLI applications:
1. App requests a device code from `POST https://github.com/login/device/code`
2. User visits `https://github.com/login/device` and enters the code
3. App polls `POST https://github.com/login/oauth/access_token` until the user authorizes
4. App receives a user access token

### Identity When Using OAuth User Tokens

OAuth user tokens **always** attribute actions to the authorizing user. When you call the GitHub API with an OAuth user token:
- PRs are created by the user
- Issues are opened by the user
- Commits (via API) are authored by the user

There is no mechanism to add agent metadata to API calls made with user OAuth tokens. The GitHub API does not have an "on behalf of agent X" header or parameter.

### GitHub App User Access Tokens (Hybrid)

GitHub Apps can also generate **user access tokens** via the device flow or web flow. These tokens:
- Act on behalf of the user (actions are attributed to the user)
- Are scoped to the app's permissions (more restrictive than the user's full access)
- Include the app's identity in the token metadata (visible to GitHub internally, but NOT displayed in the UI)

This is the closest to "user OAuth with agent attribution" but the agent identity is NOT surfaced in the GitHub UI.

### References
- [Authorizing OAuth Apps - GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Generating a user access token for a GitHub App - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Agent Identity blog post](https://usize.github.io/blog/2025/november/agent-identity.html)

## 3. Fine-Grained PATs

### Capabilities

Fine-grained Personal Access Tokens (now GA) provide:
- **Repository scoping**: Can be limited to specific repositories
- **Permission granularity**: Individual permissions (Contents: read/write, Issues: read, Pull requests: write, etc.)
- **Mandatory expiration**: Tokens must have an expiration date
- **Organization scoping**: Can be scoped to a specific org

### Identity

Fine-grained PATs are **always tied to the creating user**. There is no way to make a PAT appear as a different identity. All API calls made with a PAT are attributed to the user who created it.

### Per-Agent Scoping

You can create multiple fine-grained PATs with different scopes:
- Agent A: write access to repo X only
- Agent B: read-only access to repo Y
- Agent C: issues-only access to repo Z

This provides **permission isolation** per agent but NOT **identity separation**.

### Limitations for Agent Use

- Cannot distinguish which agent performed an action in GitHub's UI
- No GraphQL API support (as of early 2026, per Renovate docs)
- Tokens are still attributed to the user
- Each token consumes the user's rate limit quota

### References
- [Managing your personal access tokens - GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Permissions required for fine-grained PATs - GitHub Docs](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [Fine-grained PATs feedback - Community Discussion #36441](https://github.com/orgs/community/discussions/36441)

## 4. Machine Users / Bot Accounts

### GitHub's Official Guidance

GitHub explicitly permits machine user accounts:

> "User accounts are intended for humans, but you can create accounts to automate activity on GitHub. This type of account is called a machine user."

Key requirements from the Terms of Service:
- A **real human** must register the account and accept the ToS
- A **valid email address** must be provided
- The human is **responsible for the machine's actions**
- Multiple users may direct the machine account's actions

### Creating Machine Users

1. Create a new GitHub account with a dedicated email (e.g., `agent-engineer@yourdomain.com`)
2. The account is a full user account with its own:
   - SSH keys
   - PATs
   - GPG keys for commit signing
   - Profile (avatar, bio, etc.)
3. Add the machine user as a collaborator to relevant repos

### Billing Implications

- **Personal repos (free tier)**: Machine user accounts are free. Unlimited public repos, unlimited private repos, unlimited collaborators.
- **Organization membership**: Each machine user counts as a **seat** in paid org plans. On free org plans, you get unlimited collaborators on public repos but limited private repo access.
- **GitHub Enterprise**: Machine users consume enterprise seats and are subject to per-user pricing.

The free tier is sufficient for personal use with private repos. For organizations, each bot account is an additional seat cost.

### Advantages

- Full identity separation (distinct commits, PRs, issues)
- Can have its own GPG key for verified commits
- Branch protection can distinguish human vs bot
- `CODEOWNERS` can reference the bot
- Audit trails via `git log --author=bot-name`

### Disadvantages

- Each account needs a unique email
- Managing multiple accounts adds operational overhead
- Risk of ToS issues if accounts are perceived as artificial engagement
- Cannot be automated to create accounts (account creation by bots is prohibited)

### References
- [Types of GitHub accounts - GitHub Docs](https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts)
- [GitHub Terms of Service - GitHub Docs](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [Machine user guidance - Community Discussion #169685](https://github.com/orgs/community/discussions/169685)
- [Bot accounts on free plans - Community Discussion #179529](https://github.com/orgs/community/discussions/179529)

## 5. Git Author vs Committer

### The Distinction

Git stores two identities per commit:
- **Author**: The person who originally wrote the work
- **Committer**: The person who applied the work to the repository

These can differ. For example, in `cherry-pick` or `rebase`, the author stays the same but the committer changes.

### Environment Variables

```bash
# Per-command override (does not modify ~/.gitconfig)
GIT_AUTHOR_NAME="Claude Engineer" \
GIT_AUTHOR_EMAIL="claude-engineer@noreply.local" \
GIT_COMMITTER_NAME="Nathan Heaps" \
GIT_COMMITTER_EMAIL="nathan@example.com" \
git commit -m "feat: implement feature"
```

Or using `--author` flag:
```bash
git commit --author="Claude Engineer <claude-engineer@noreply.local>" -m "feat: implement feature"
```

### How GitHub Displays This

- The **author** is shown as the primary identity on the commit
- If the committer differs, GitHub shows the committer's avatar as a **small overlay icon** on the author's avatar
- The commit detail view shows both author and committer
- GitHub links the author/committer to a GitHub account **only if the email matches** a verified email on a GitHub account

### Email Verification

**GitHub does NOT verify or reject author emails.** You can set any email as the author. However:
- If the email matches a GitHub account's verified email, the commit links to that account
- If it doesn't match any account, GitHub shows a generic avatar with the name
- Unmatched emails do NOT count as GitHub contributions (no green squares)

### GPG Signing Implications

GPG signatures are tied to the **committer**, not the author. If you sign commits:
- The signature must match the committer's identity
- You can have a different author and still have a verified commit (the "Verified" badge means the committer's GPG key is valid)

### Best Practice for Agents

Set agents as **author** and keep the human as **committer**:
```bash
# Agent makes the code change, human is responsible
GIT_AUTHOR_NAME="Claude Engineer (Agent)" \
GIT_AUTHOR_EMAIL="claude-engineer+agent@users.noreply.github.com" \
git commit -m "feat: implement feature"
# GIT_COMMITTER_* defaults to user's git config
```

This preserves:
- Agent attribution (who wrote it)
- Human accountability (who approved/applied it)
- GPG verification (committer can sign)
- Audit capability (`git log --author="Agent"`)

### References
- [Git - git-commit Documentation](https://git-scm.com/docs/git-commit/2.33.0)
- [Git Author vs. Committer - Medium](https://javascript.plainenglish.io/git-author-vs-committer-whats-the-difference-57428d2ae644)
- [Author and Committer in Git](https://ivan.bessarabov.com/blog/git-author-committer)
- [Agent Identity for Git Commits - Justin Poehnelt](https://justin.poehnelt.com/posts/agent-identity-git-commits/)

## 6. Co-authored-by and Attribution

### How It Works

Add trailers to commit messages:
```
feat: implement login flow

Implemented OAuth login with session management.

Co-authored-by: Claude Code <noreply@anthropic.com>
Co-authored-by: Nathan Heaps <nathan@example.com>
```

### GitHub UI Rendering

- GitHub parses `Co-authored-by` trailers and renders co-authors in the commit view
- Co-authors appear as avatars next to the primary author
- If the email matches a GitHub account, it links to that profile
- Co-authored commits **count as contributions** for the co-author (green squares) if the email matches their GitHub account
- Squash merges preserve co-author trailers

### Format Requirements

- Must be preceded by a blank line (two newlines after the commit body)
- Format: `Co-authored-by: Name <email@example.com>`
- Multiple co-authors: one per line
- Email must match a GitHub account's email for linking (use `username@users.noreply.github.com` for privacy)

### Beyond Co-authored-by

Other git trailers that could be used for agent attribution:
- `Signed-off-by: Agent Name <email>` -- DCO compliance
- Custom trailers: `Agent-Name: Claude Engineer` (git supports arbitrary trailers but GitHub doesn't render them specially)

### Current Claude Code Pattern

Claude Code uses:
```
Co-Authored-By: Claude Code (claude.ai/code) <noreply@anthropic.com>
```

This is rendered by GitHub but does NOT link to a GitHub account (no account has that email).

### Limitations

- Co-authored-by is metadata only -- it doesn't affect permissions, branch protection, or API attribution
- Anyone can add any Co-authored-by trailer (no verification)
- Not useful for distinguishing which agent among multiple agents made a change

### References
- [Creating a commit with multiple authors - GitHub Docs](https://docs.github.com/articles/creating-a-commit-with-multiple-authors)
- [Claude Code Co-Authored-By Attribution - DeployHQ](https://www.deployhq.com/blog/how-to-use-git-with-claude-code-understanding-the-co-authored-by-attribution)

## 7. How Existing Tools Handle Identity

### Dependabot

- **Identity**: `dependabot[bot]` (a GitHub App bot account)
- **Email**: `dependabot[bot]@users.noreply.github.com` or `support@dependabot.com`
- **Authentication**: GitHub App installation token (Dependabot is a first-party GitHub App)
- **Commits**: Appear as authored by `dependabot[bot]` with a verified badge when made via the API
- **Note**: Dependabot has a second identity (`dependabot-bot`) used for GPG-signed commits because GitHub doesn't allow uploading GPG keys for `[bot]` accounts
- **References**: [Seeing different GitHub authors - dependabot/feedback#191](https://github.com/dependabot/feedback/issues/191)

### Renovate

- **Hosted (Mend)**: Runs as a GitHub App (`renovate[bot]`)
- **Self-hosted**: Supports multiple auth methods:
  1. GitHub App installation token (preferred)
  2. Classic PAT with `repo` scope
  3. Fine-grained PATs are NOT supported (no GraphQL API support)
- **Commits**: When using GitHub App + `platformCommit: true`, commits are made via the API and get **verified** badges
- **Signed commits**: Only possible via API-based commits with a GitHub App token
- **References**: [Renovate GitHub Platform Docs](https://docs.renovatebot.com/modules/platform/github/)

### GitHub Actions Bot

- **Identity**: `github-actions[bot]`
- **Email**: `github-actions[bot]@users.noreply.github.com`
- **What it is**: NOT a GitHub App -- it's a built-in system account
- **Authentication**: Uses `GITHUB_TOKEN` (automatically provisioned per workflow run)
- **Commits**: To attribute commits to the Actions bot, configure git manually:
  ```bash
  git config user.name 'github-actions[bot]'
  git config user.email 'github-actions[bot]@users.noreply.github.com'
  ```
- **Limitation**: Commits don't show the Actions bot icon (gray avatar instead), unlike how the bot appears in PR comments
- **References**: [GitHub Actions bot email - Community Discussion #26560](https://github.com/orgs/community/discussions/26560)

### GitHub Copilot (Coding Agent)

- **Identity**: Commits authored by "GitHub Copilot" as the committer
- **Attribution**: The assigning developer is added as a `Co-authored-by` trailer
- **Pattern**: Copilot is the author/committer; human is the co-author (inverse of Claude Code's pattern)
- **Signed commits**: NOT supported -- no way to bypass branch protection requiring signed commits
- **Controversy**: Users have complained about Copilot being the primary author rather than the human
- **References**: [About GitHub Copilot coding agent - GitHub Docs](https://docs.github.com/en/copilot/concepts/coding-agent/coding-agent), [Community Discussion #179983](https://github.com/orgs/community/discussions/179983)

### Claude Code

- **Identity**: Uses the user's git config for author/committer
- **Attribution**: Adds `Co-Authored-By: Claude Code (claude.ai/code) <noreply@anthropic.com>` trailer
- **Signed commits**: Supported (uses user's GPG key)
- **Pattern**: Human is author+committer; Claude is co-author

### Aider

- **Identity**: Appends `(aider)` to the author name (e.g., `Nathan Heaps (aider)`)
- **Attribution**: Adds the AI model as co-author: `Co-authored-by: Claude 3.5 Sonnet (via aider)`
- **Pattern**: Modified human name as author; AI model as co-author

## 8. User OAuth for Agent Identity

### The Core Question

Can an OAuth App authenticate as the user but add agent-level metadata to distinguish which agent performed the action?

### Short Answer: No Standard Mechanism

When using a user access token (whether from an OAuth App or a GitHub App's user access token flow):
- All API calls are attributed to the **user**, not the app
- GitHub's API has no parameter or header for "agent identity" or "on behalf of"
- The source app is tracked internally by GitHub but is NOT displayed in the UI

### What User OAuth Tokens Actually Do

| Aspect | User OAuth Token | Installation Token |
|:-------|:----------------|:-------------------|
| API attribution | User | App bot |
| Rate limit | User's quota (5000/hr) | App's quota (scales with installs) |
| Permissions | App's requested scopes (subset of user's) | App's installation permissions |
| Token lifetime | Until revoked | 1 hour |
| Commit author (API) | User | App bot |

### Possible Workarounds

1. **Custom commit trailers**: Add agent-identifying trailers to commit messages:
   ```
   Agent-Name: Claude Engineer
   Agent-Session: tmux-pane-3
   ```
   GitHub won't render these specially, but they're queryable via `git log --grep`.

2. **PR/Issue body metadata**: Include agent identity in PR descriptions or issue comments.

3. **GitHub App user-to-server tokens**: The token metadata includes which app generated it, but this is only visible to GitHub internally and via API introspection, not in the UI.

4. **Separate branches per agent**: Use branch naming conventions (e.g., `agent/engineer/feature-x`) to associate work with specific agents.

### Why User OAuth Is Still Interesting

Despite lacking agent-level attribution in the UI, user OAuth has advantages:
- Actions count as the user's contributions (green squares)
- Works with existing branch protection rules
- No additional seats or accounts needed
- Combined with git author/committer split, you get agent identity in git history while API actions remain user-attributed

### References
- [Differences between GitHub Apps and OAuth Apps - GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [PAT vs OAuth vs GitHub App - Community Discussion #109668](https://github.com/orgs/community/discussions/109668)
- [GitHub App vs GitHub OAuth - Nango Blog](https://nango.dev/blog/github-app-vs-github-oauth)

## Comparison Matrix

| Approach | Agent Identity? | Commits? | PRs/Issues? | Cost | Complexity | Verified Commits? |
|:---------|:---------------|:---------|:------------|:-----|:-----------|:-------------------|
| GitHub App (installation token) | Yes -- `app[bot]` | Via API: bot identity | Bot identity | Free (self-hosted) | Medium -- key mgmt, JWT, token refresh | Yes (API commits) |
| GitHub App (user access token) | No -- appears as user | User identity | User identity | Free | Medium | No (user signs) |
| OAuth App (user token) | No -- appears as user | User identity | User identity | Free | Low-Medium | No (user signs) |
| Fine-grained PAT | No -- appears as user | User identity | User identity | Free | Low | No (user signs) |
| Machine user account | Yes -- separate account | Full bot identity | Bot identity | Free (personal) / seat cost (org) | High -- email, account mgmt | Yes (own GPG key) |
| Git author/committer split | Partial -- git only | Agent as author, user as committer | N/A (git only) | Free | Very Low | Yes (committer signs) |
| Co-authored-by trailer | Attribution only | Co-author badge | N/A | Free | Very Low | N/A |
| Custom git trailers | Metadata only | Queryable in git log | N/A | Free | Very Low | N/A |

## Recommended Approach for Claude Code Agent Teams

For the tmux-pane agent team use case, a layered approach works best:

### Tier 1: Immediate (Zero Infrastructure)
- **Git author/committer split**: Each agent sets `GIT_AUTHOR_NAME="Agent Name (Role)"` and `GIT_AUTHOR_EMAIL="agent-role@noreply.local"`
- **Co-authored-by**: Keep the existing Claude Code trailer
- **Custom trailers**: Add `Agent-Role: Engineer` or similar

### Tier 2: Enhanced (One-Time Setup)
- **Single GitHub App**: Create one private GitHub App for your agent team
- Use installation tokens for API calls (PRs, issues)
- Commits via API get verified badges
- All agents share the `your-team[bot]` identity but use git author for per-agent distinction

### Tier 3: Full Separation (Ongoing Maintenance)
- **Multiple GitHub Apps** or **machine user accounts**: One per agent role
- Each agent has a fully distinct GitHub identity
- Higher operational overhead but maximum auditability

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| Git author/committer split works without verification | High -- well-documented, widely used |
| GitHub Apps provide distinct bot identity | High -- this is exactly how Dependabot/Renovate work |
| User OAuth tokens cannot carry agent metadata in UI | High -- confirmed by GitHub docs |
| Machine user accounts are permitted by ToS | High -- explicitly documented by GitHub |
| API-based commits with App tokens get verified badges | High -- documented and used by Renovate/Dependabot |
| Fine-grained PATs always show user identity | High -- by design |
| GitHub App user access tokens track source app internally | Medium -- documented but UI visibility unconfirmed |
| Custom git trailers are not rendered by GitHub UI | Medium -- no documentation says they are; testing would confirm |
| Machine user free tier is sufficient for private repos | Medium -- terms could change |
| Copilot's attribution pattern (bot as author, human as co-author) is controversial | High -- multiple community discussions |

## Sources

- [Generating installation access tokens - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [Authenticating as a GitHub App installation - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Generating a user access token for a GitHub App - GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Differences between GitHub Apps and OAuth Apps - GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)
- [Authorizing OAuth Apps - GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Managing your personal access tokens - GitHub Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Types of GitHub accounts - GitHub Docs](https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts)
- [GitHub Terms of Service - GitHub Docs](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [About commit signature verification - GitHub Docs](https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification)
- [Creating a commit with multiple authors - GitHub Docs](https://docs.github.com/articles/creating-a-commit-with-multiple-authors)
- [About per-user pricing - GitHub Docs](https://docs.github.com/en/billing/managing-the-plan-for-your-github-account/about-per-user-pricing)
- [About GitHub Copilot coding agent - GitHub Docs](https://docs.github.com/en/copilot/concepts/coding-agent/coding-agent)
- [Renovate GitHub Platform Docs](https://docs.renovatebot.com/modules/platform/github/)
- [Agent Identity for Git Commits - Justin Poehnelt](https://justin.poehnelt.com/posts/agent-identity-git-commits/)
- [Attribute Git Commits to AI Agents - Eleanor Berger](https://elite-ai-assisted-coding.dev/p/attribute-git-commits-to-ai-agents)
- [Why AI Agents Need Their Own Identity - WSO2](https://wso2.com/library/blogs/why-ai-agents-need-their-own-identity-lessons-from-2025-and-resolutions-for-2026/)
- [Agent Identity blog - usize.github.io](https://usize.github.io/blog/2025/november/agent-identity.html)
- [GitHub App vs GitHub OAuth - Nango Blog](https://nango.dev/blog/github-app-vs-github-oauth)
- [PAT vs OAuth vs GitHub App - Community Discussion #109668](https://github.com/orgs/community/discussions/109668)
- [How to Use Commit Signing with GitHub Apps - Community Discussion #50055](https://github.com/orgs/community/discussions/50055)
- [GitHub Actions bot email - Community Discussion #26560](https://github.com/orgs/community/discussions/26560)
- [Copilot author attribution - Community Discussion #179983](https://github.com/orgs/community/discussions/179983)
- [Machine user bot accounts ToS - Community Discussion #179529](https://github.com/orgs/community/discussions/179529)
- [verified-bot-commit GitHub Action](https://github.com/IAreKyleW00t/verified-bot-commit)
- [Signing commits in GitHub Actions - httgp.com](https://httgp.com/signing-commits-in-github-actions/)
