# Research: PRD vs Spec Terminology — Industry Norms

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: How do established engineering organizations distinguish PRDs from specs?

## Executive Summary

PRDs and technical specs (design docs) serve fundamentally different audiences and answer different questions: PRDs define **what** to build and **why** (product/business perspective), while specs define **how** to build it (engineering perspective). Mature organizations almost universally maintain this separation, though the specific document formats vary widely — from Google's design docs to Amazon's PR/FAQs. For small teams and AI-agent workflows, a lightweight two-document approach (one product-facing, one technical) remains valuable, but the documents can be shorter and combined into a single file with clear sections.

## 1. Standard Definitions

### PRD (Product Requirements Document)

A PRD is a product-management-owned document that defines the **what** and **why** of a product or feature. It typically includes:

- Problem statement and user needs
- Goals, success metrics, and non-goals
- User stories or use cases
- Feature requirements (functional and non-functional)
- Constraints, dependencies, and timeline

The audience is cross-functional: engineering, design, QA, marketing, and leadership. The PRD is written **before** engineering begins and is intended to align stakeholders on scope and priorities.

Sources:
- [ProductPlan: What Is a PRD?](https://www.productplan.com/glossary/product-requirements-document/)
- [Productboard: PRD Guide](https://www.productboard.com/blog/product-requirements-document-guide/)
- [Marty Cagan: How to Write a Good PRD (2005)](https://www.cimit.org/documents/20151/228904/How%20To%20Write%20a%20Good%20PRD.pdf/9262a05e-05b2-6c19-7a37-9b2196af8b35)

### Technical Spec / Design Doc

A technical spec (also called a design doc, engineering design doc, or RFC) is an engineering-owned document that defines **how** a system will be built. It typically includes:

- System architecture and component design
- API contracts and data models
- Trade-off analysis and alternatives considered
- Security, scalability, and observability considerations
- Migration strategy and rollout plan

The audience is primarily engineering, though senior leadership may review for major projects. It is written **after** the PRD establishes what needs to be built.

Sources:
- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [The Pragmatic Engineer: RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)

### Key Distinction

| Dimension | PRD | Tech Spec / Design Doc |
|:----------|:----|:----------------------|
| Owner | Product Manager | Engineer / Tech Lead |
| Question answered | What to build and why | How to build it |
| Audience | Cross-functional | Engineering team |
| Timing | Before design/engineering | After PRD, before coding |
| Volatility | Changes with user feedback and market | More stable once approved |
| Success criteria | User/business outcomes | Technical correctness, performance |

## 2. Mature Organization Practices

### Google

Google uses **design docs** as a core engineering practice. These are informal documents written by the primary engineer before coding begins. They cover context, goals, non-goals, architecture, trade-offs, and alternatives considered. Google does NOT call these PRDs — they are explicitly engineering artifacts focused on implementation strategy. Product requirements come from PMs through separate channels (OKRs, launch documents, product briefs). Google's canonical templates require engineers to consider security, i18n, storage, and privacy implications.

Source: [Design Docs at Google (Malte Ubl)](https://www.industrialempathy.com/posts/design-docs-at-google/)

### Amazon

Amazon replaces the traditional PRD with the **PR/FAQ** (Press Release / Frequently Asked Questions) — a narrative "working backwards" document. The PR/FAQ describes the product from the customer's perspective as if it were launch day. It is a 6-page maximum narrative document (no bullet points, no slides) read silently at the start of meetings. Technical design reviews happen separately. Amazon explicitly separates the "what/why" (PR/FAQ) from the "how" (technical design).

Sources:
- [Working Backwards PR/FAQ Process](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/)
- [Amazon Working Backwards Template](https://www.hustlebadger.com/what-do-product-teams-do/amazon-working-backwards-process/)

### Stripe

Stripe is known for a "strong writing culture" and combines product thinking with engineering rigor. Their approach tends to merge product and technical concerns more than Google or Amazon, with emphasis on API design and developer experience. PRDs and tech specs may be more interleaved, but the conceptual separation (what vs. how) persists.

Source: [The Pragmatic Engineer: RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)

### Uber

Uber uses detailed RFCs that address service dependencies, performance testing, and monitoring. They introduced **lightweight templates** for smaller changes to reduce overhead. The RFC serves as the technical spec; product requirements come from PMs through a separate process.

Source: [The Pragmatic Engineer: RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)

### Facebook/Meta

Notably, Facebook has **less documentation** than most tech companies. Their culture emphasizes speed and iteration over upfront planning documents. When documentation exists, it tends to be lighter-weight and more engineering-focused.

Source: [The Pragmatic Engineer: RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)

### Summary Pattern

Every mature organization examined maintains a conceptual separation between product intent and technical design, even if the document names and formats differ wildly:

| Company | "What/Why" Document | "How" Document |
|:--------|:-------------------|:---------------|
| Google | Product briefs, OKRs | Design docs |
| Amazon | PR/FAQ (6-pager) | Technical design review |
| Stripe | Product spec | Engineering RFC |
| Uber | Product requirements | RFC |
| Meta | Lightweight briefs | Lightweight design docs |

## 3. Industry Trends

### Trend 1: Away from Heavyweight PRDs

Marty Cagan, one of the original PRD advocates (his 2005 guide was 37 pages), reversed his position by 2006 and now rarely recommends PRDs. He argues they create a "false sense of progress" and advocates for high-fidelity prototypes supplemented by lightweight documentation. His critique: PRDs are often written **instead of** discovery work, rather than as a result of it.

Source: [SVPG: Revisiting the Product Spec](https://www.svpg.com/revisiting-the-product-spec/)

### Trend 2: Toward Lightweight, Living Documents

The trend across the industry is toward shorter, more focused documents:
- One-pagers instead of multi-page PRDs
- RFCs with clear templates instead of freeform design docs
- Living documents (Notion, Google Docs) instead of static PDFs
- Lightweight templates for small changes, full templates for major ones (Uber's approach)

Source: [Pragmatic Engineer: Engineering Planning with RFCs](https://newsletter.pragmaticengineer.com/p/rfcs-and-design-docs)

### Trend 3: Separation Persists, Formats Evolve

Despite the move toward lighter documents, the **conceptual separation** between product intent and technical design has not collapsed. Even companies that use a single document (like a combined RFC) maintain distinct sections for "problem/requirements" vs. "proposed solution/architecture." The separation is about **role clarity** and **audience**, not document count.

### Trend 4: Writing Culture as Engineering Practice

Companies like Stripe, Amazon, and increasingly startups treat writing as a core engineering skill. The act of writing forces clarity of thought. This trend favors some form of written artifact over purely verbal planning, even for small teams.

### Trend 5: Early-Stage Companies Adopt Lightweight Versions

Companies as small as 5-80 engineers (Stedi, Incident.io, Ashby) successfully use RFC/design doc processes. The overhead is minimal when templates are lightweight and the culture values writing.

Source: [The Pragmatic Engineer: RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)

## 4. Relevance for Small Teams / AI Agents

### The Distinction Remains Useful

Even for solo developers or small teams working with AI agents, the **conceptual** distinction between "what/why" and "how" is valuable:

1. **Forces clarity of thought**: Writing down what you want to build (and why) before jumping to implementation prevents scope creep and wasted effort.
2. **AI agents benefit from clear requirements**: When delegating work to AI coding agents, a clear statement of requirements (PRD-like) helps the agent make better decisions than a technical spec alone. The agent needs to understand user intent, not just API contracts.
3. **Different review cadences**: Product requirements change with user feedback; technical designs change with implementation learnings. Separating them prevents one type of change from obscuring the other.

### The Overhead Can Be Eliminated

What is NOT useful for small teams / AI agents:
- Separate heavyweight documents with formal review processes
- Rigid templates that add ceremony without value
- Multiple approval gates between PRD and spec

### Recommended Approach for Small Teams / AI Agents

A pragmatic middle ground:

1. **Single file, two sections**: Use one markdown file with a clear "Requirements" section (what/why) and a "Design" section (how). This preserves the conceptual separation without document management overhead.
2. **Keep it short**: The requirements section can be 5-15 bullet points. The design section can be a paragraph or two plus key decisions.
3. **Use the PRD section as the AI agent's briefing**: When handing work to an AI agent, the requirements section serves as the "task context" — it tells the agent what success looks like.
4. **Use the spec section for implementation constraints**: The design section tells the agent about architectural decisions, patterns to follow, and technical constraints.
5. **Iterate in place**: Update the document as you learn, rather than creating new versions.

### For This Project Specifically

Given the `docs/specs/` structure already in this repository, a practical approach would be:
- **Spec files** serve double duty: a "Requirements" section at the top (PRD-equivalent) followed by "Design" details (spec-equivalent)
- No separate PRD files needed unless the project grows to have dedicated product and engineering roles
- The existing draft/reviewed/in-progress/live lifecycle already handles document maturity

## Practical Recommendation

**Keep the conceptual separation; collapse the document count.**

For solo developers and small teams (especially those working with AI agents):

1. Use a single spec document per feature with clearly labeled sections for requirements (what/why) and design (how).
2. The "requirements" section is your PRD-equivalent — keep it focused on user outcomes and success criteria.
3. The "design" section is your tech spec — keep it focused on architecture decisions and trade-offs.
4. Do not create separate PRD and spec documents unless you have distinct product and engineering roles that need to own different documents.
5. When delegating to AI agents, always include the requirements context (not just technical instructions) — this is the single biggest lever for getting better output from AI coding assistants.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| PRD = what/why, spec = how (standard definitions) | High — universal across all sources |
| Mature orgs maintain conceptual separation | High — confirmed across Google, Amazon, Stripe, Uber |
| Document formats vary widely between orgs | High — well-documented variation |
| Trend away from heavyweight PRDs | High — Cagan, Pragmatic Engineer, multiple sources agree |
| Trend toward lightweight/living documents | High — consistent across 2023-2025 sources |
| Conceptual separation still valuable for small teams | Medium-High — logical extrapolation from principles, less direct evidence |
| Single-file approach works for AI agent workflows | Medium — based on reasoning about AI agent needs, limited direct research |

## Sources

- [Design Docs at Google — Malte Ubl](https://www.industrialempathy.com/posts/design-docs-at-google/)
- [The Pragmatic Engineer: Companies Using RFCs or Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/)
- [The Pragmatic Engineer: Engineering Planning with RFCs, Design Documents and ADRs](https://newsletter.pragmaticengineer.com/p/rfcs-and-design-docs)
- [SVPG: Revisiting the Product Spec — Marty Cagan](https://www.svpg.com/revisiting-the-product-spec/)
- [Marty Cagan: How to Write a Good PRD (2005 PDF)](https://www.cimit.org/documents/20151/228904/How%20To%20Write%20a%20Good%20PRD.pdf/9262a05e-05b2-6c19-7a37-9b2196af8b35)
- [ProductPlan: What Is a PRD?](https://www.productplan.com/glossary/product-requirements-document/)
- [Productboard: PRD Guide](https://www.productboard.com/blog/product-requirements-document-guide/)
- [Working Backwards PR/FAQ Process](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/)
- [Amazon Working Backwards Template — Hustle Badger](https://www.hustlebadger.com/what-do-product-teams-do/amazon-working-backwards-process/)
- [SVPG: Discovery vs. Documentation](https://www.svpg.com/discovery-vs-documentation/)
- [Medium: PRD vs TRD](https://medium.com/@kokoproduct/decoding-the-dichotomy-prd-vs-trd-67463a29aa84)
- [Plane Blog: How to Write a PRD Engineers Actually Read](https://plane.so/blog/how-to-write-a-prd-that-engineers-actually-read)
- [LinkedIn: Design Docs, RFC & PRD](https://www.linkedin.com/pulse/design-docs-rfc-prd-omar-jose-perez-tacare)
