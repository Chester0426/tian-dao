# /change: Upgrade Implementation

> Invoked by change.md Step 6 when type is Upgrade.
> Read the full change skill at `.claude/commands/change.md` for lifecycle context.

## Prerequisites from change.md

- idea.yaml and EVENTS.yaml have been read (Step 2)
- Change classified as Upgrade (Step 3)
- Preconditions checked (Step 4)
- Plan approved (Phase 1)
- Specs updated (Step 5)

## Implementation

- If `quality: production` is set in idea.yaml:
  1. Generate TDD tasks for the integration per `patterns/tdd.md`:
     - Credential storage/retrieval
     - Webhook signature validation (if applicable)
     - Error recovery (timeout, rate limit, invalid response)
     - Happy path end-to-end
  2. Spawn implementer agents (same procedure as Feature production path)
  3. Continue to Step 7
- If `quality` is absent or `mvp` (default):
- Read or generate the external stack file for the service (`.claude/stacks/external/<service-slug>.md`) — use the same generation procedure as described in `.claude/procedures/scaffold-externals.md` (Step 6)
- Replace the Fake Door component with real UI that calls the actual API route
- Replace any stub route (501/503) with the full integration logic using the service's API
- Remove `fake_door: true` from the `activate` event call — keep the same event name (`activate`) and `action` value for analytics continuity
- Add the service's env vars to `.env.example`
- Ask the user for credential values and add to `.env.local`
- Verify the end-to-end user flow after the upgrade: UI → API route → external service
