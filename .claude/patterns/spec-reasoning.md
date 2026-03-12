# Spec Reasoning Checklists

Quality checklists consumed by `/spec` at STOP points. Each section provides structured reasoning criteria for evaluating the spec at a specific stage.

## 1. Market Sizing Reasoning

Applied after Step 2 (Pre-flight Research). Evaluate whether the market is real and reachable.

**Checklist:**
- [ ] **Addressable market identified**: Can you name a specific, bounded group of potential users? (e.g., "freelance designers billing 1-5 clients/month" not "freelancers")
- [ ] **Active spending**: Are people currently paying money or significant time to solve this problem? Name at least one existing solution they pay for.
- [ ] **Market signals**: At least 2 of: forum threads discussing the pain, competitor reviews mentioning gaps, job postings for this function, industry reports sizing the segment.
- [ ] **Reachable via chosen channels**: Can you reach 100+ target users through the planned distribution channels within the experiment window?
- [ ] **Not a shrinking market**: The problem isn't being eliminated by a platform change, regulation, or technology shift.

**Red flags:**
- Market exists only in theory (no evidence of current spending/time investment)
- Target user is too broad to reach efficiently ("anyone who..." is not an ICP)
- Only evidence is the founder's personal experience (sample size of 1)

## 2. Competitive Differentiation Reasoning

Applied after Step 2 (Pre-flight Research). Evaluate whether the proposed solution has a defensible angle.

**Checklist:**
- [ ] **Competitors identified**: Named at least 2 existing alternatives (direct or indirect — includes spreadsheets, manual processes, hiring someone)
- [ ] **Gap articulated**: One specific thing competitors do poorly or don't do at all, validated by user complaints (reviews, forum posts, support tickets)
- [ ] **Differentiation is user-facing**: The difference matters to the target user, not just technically interesting. "Faster" must be measurably faster at a task users care about.
- [ ] **Not just cheaper**: Price-only differentiation is fragile. At least one non-price advantage exists.
- [ ] **Timing advantage**: Why now? Something changed (new API, regulation, market shift, unserved niche) that makes this solvable today in a way it wasn't before.

**Red flags:**
- No competitors found (usually means no market, not a blue ocean)
- Differentiation requires explaining — if the user can't see the difference in 5 seconds, it's not differentiated enough for an MVP
- "We'll do it better" without specifying what "better" means concretely

## 3. Hypothesis Quality Reasoning

Applied after Step 3 (Generate Hypotheses). Evaluate whether hypotheses are testable and well-structured.

**Checklist:**
- [ ] **Each hypothesis has a numeric threshold**: "5% CTR" not "good conversion rate"
- [ ] **Thresholds are grounded**: Based on industry benchmarks, competitor data, or first-principles calculation — not arbitrary round numbers
- [ ] **Categories covered**: All required categories for the selected level have at least one pending hypothesis
- [ ] **No duplicates**: Each hypothesis tests a genuinely independent risk. "Users will sign up" and "Users will create an account" test the same thing.
- [ ] **Dependencies are explicit**: If hypothesis B can't be tested until hypothesis A is validated, `depends_on` reflects this
- [ ] **Falsifiable**: Each hypothesis can clearly fail. "Users will find value" is not falsifiable; "5+ users complete an invoice within 7 days" is.
- [ ] **Level-appropriate**: No monetize hypotheses at Level 1, no retain hypotheses if the experiment window is <7 days

**Red flags:**
- All thresholds are round numbers (50%, 100 users) — suggests guessing, not reasoning
- More than level minimum + 2 hypotheses — scope creep, testing too many things at once
- Hypothesis that can only be confirmed, never rejected (survivorship bias)

## 4. Behavior Traceability Reasoning

Applied internally during Step 4 (Derive Behaviors). Not a STOP point — used as a self-check.

**Checklist:**
- [ ] **Every pending hypothesis has ≥1 behavior**: No hypothesis is left without an observable test
- [ ] **Every behavior traces to a hypothesis**: No orphan behaviors that don't validate anything
- [ ] **Behaviors are observable**: Each maps to an analytics event, database state change, or user-visible action
- [ ] **Tests are verifiable**: Each behavior's `tests` list contains assertions that can be automated (page renders X, clicking Y navigates to Z)
- [ ] **No implementation leakage**: Behaviors describe WHAT the user does, not HOW the code works ("user creates an invoice" not "API endpoint returns 200")

## 5. Variant Distinctiveness Reasoning

Applied after Step 5 (Generate Variants). Evaluate whether variants test genuinely different angles.

**Checklist:**
- [ ] **>30% word difference**: Compare each pair of headlines — they must differ by more than 30% of words (not just synonyms or reordering)
- [ ] **Different emotional angles**: Each variant targets a distinct motivation (e.g., time-saving vs cost-saving vs status vs fear-of-missing-out)
- [ ] **Pain points are specific**: Each variant's 3 pain points reference concrete situations the target user experiences, not generic problems
- [ ] **CTAs are action-oriented**: Each CTA starts with a verb and implies an outcome ("Start invoicing free" not "Learn more")
- [ ] **No variant is clearly superior**: If one variant is obviously better than others, the test won't produce useful signal — strengthen the weaker variants

**Red flags:**
- Headlines differ only by a word or two ("Save Time on Invoicing" vs "Save Hours on Invoicing")
- All variants use the same emotional angle (three versions of "save time")
- Pain points are copy-pasted across variants with minor edits
- A variant's headline doesn't connect to its pain points (messaging mismatch)

## 6. Stack Appropriateness Reasoning

Applied internally during Step 6 (Assemble experiment.yaml). Not a STOP point — used as a self-check.

**Checklist:**
- [ ] **Level-appropriate stack**: Level 1 has no database/auth, Level 2 adds database, Level 3 adds auth (and payment if monetize hypotheses exist)
- [ ] **No over-engineering**: Stack components match what's needed to test the hypotheses, not what would be needed at scale
- [ ] **Distribution-compatible**: The stack supports the planned distribution channels (e.g., if targeting paid ads, analytics must be present for conversion tracking)
- [ ] **Testing-compatible**: If `quality: production`, `stack.testing` is present
- [ ] **No conflicting stacks**: No incompatible combinations (e.g., Playwright with service archetype)
