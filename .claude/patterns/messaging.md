# Conversion Messaging Framework

Shared copy and structure rules for landing pages (`/bootstrap`) and ad campaigns (`/distribute`).
Both skills derive conversion copy from `idea.yaml` — this file ensures they say the same thing.

## Section A: Copy Derivation Rules

Derive all conversion copy from idea.yaml fields. Never use raw field values as headlines.

### Headline

Formula: **"[Verb] [desired outcome] [qualifier]"** — derived from `solution` + `target_user`, NOT from `title`.

- `title` is the product name/brand (e.g., "QuickBill — Fast Invoicing for Freelancers")
- The headline is the value proposition (e.g., "Invoice Clients in 60 Seconds")

Anti-pattern: using `title` as the headline. That's branding, not conversion.

### Subheadline

One sentence explaining HOW — derived from `solution`. Can use the first sentence of `solution` more directly, but rewrite for clarity if needed.

### CTA

Formula: **"{action verb} + {outcome}"** — not generic labels like "Sign up" or "Get started".

Examples:
- "Send Your First Invoice"
- "Start Tracking Free"
- "Build Your First Page"

### Pain points

3 short statements derived from the `problem` field. Each addresses one aspect of the pain.

Format: icon/emoji + short statement (e.g., "Manual invoicing wastes hours every week").

## Section B: Landing Page Required Elements

Every landing page must include all of these elements. The specific arrangement, styling, and visual treatment are chosen by the AI (with the frontend-design plugin when active) — there is no fixed section order.

**Required elements:**
- **Value proposition above the fold**: headline + subheadline (derived from Section A rules)
- **Primary CTA**: the call-to-action button (derived from Section A rules)
- **Pain points or social proof**: derived from idea.yaml `problem` — 3 short statements addressing aspects of the pain
- **Feature highlight**: derived from idea.yaml `features` — showcase what the product does
- **CTA repeat**: the same CTA must appear at least twice on the page (once above the fold, once further down)

When landing is the only page (features as sections), apply the same required elements but with feature sections being interactive rather than descriptive cards.

> **Testing note**: Because the CTA appears 2+ times on landing pages, test selectors targeting CTA buttons must use `.first()` to avoid ambiguous matches.

## Section C: Message Match Rules

Rules ensuring ad-to-landing consistency:

- Ad headlines MUST be derived from the same headline as the landing page (shortened to fit the channel's ad format constraints — see distribution stack file)
- Ad descriptions MUST match the landing page subheadline in meaning
- CTA language MUST be consistent across ads and landing page
- The landing page headline should be recognizable to someone who just clicked the ad

## Section D: Variant Messaging Rules

When idea.yaml has a `variants` field, these rules extend Sections A–C:

### Variant Copy Source
- Each variant defines its own `headline`, `subheadline`, `cta`, and `pain_points`.
- These fields **replace** the copy that Section A would derive from `solution` + `target_user` + `problem`.
- The variant copy IS the messaging — do not re-derive from solution/target_user.

### Landing Page Structure
- Each variant uses the **same** page structure (chosen by AI at bootstrap). Variant fields slot into the shared layout.
- Variant fields slot into Hero and Pain Points. Features section is shared across all variants (from idea.yaml `features`).

### Default Variant
- The variant with `default: true` (or the first in the list) renders at root `/`.
- All variants also render at `/v/<slug>`.
- The default variant is accessible at both `/` and `/v/<default-slug>`.

### Message Match for Variants
- Section C rules apply **per variant**: each variant's ad group must match its landing page headline.
- Ad headlines for a variant are shortened from that variant's `headline` field, not from the shared `solution`.
