---
assumes: []
packages:
  runtime: []
  dev: []
files: []
env:
  server: []
  client: []
ci_placeholders: {}
clean:
  files: []
  dirs: []
gitignore: []
---
# Distribution: Google Ads
> Used when `/distribute` is run with channel `google-ads`
> Assumes: None — distribution stacks create no source code or packages; they generate config only

## Ad Format Constraints

**Responsive Search Ads (RSA):**
- Headlines: 3–30 characters each, minimum 5 per ad
- Descriptions: up to 90 characters each, minimum 2 per ad
- Minimum 2 ad variations per campaign
- Google assembles the best combination from your headlines and descriptions

## Targeting Model

**Keyword-based targeting** — ads appear when users search for matching terms.

Match types:
- **Exact match** `[keyword]` — highest intent, most specific
- **Phrase match** `"keyword"` — moderate intent, word order matters
- **Broad match** `keyword` — widest reach, Google infers intent
- **Negative keywords** — exclude irrelevant searches

Minimum keyword counts:
- Exact: 3+
- Phrase: 2+
- Broad: 1+
- Negative: 2+

No demographic or audience targeting initially — let Google optimize.

## Click ID

**Parameter name:** `gclid` (Google Click ID)

Google auto-appends `gclid` to the landing URL when a user clicks an ad. Capture it on the landing page and include it in analytics events for offline conversion matching.

## Conversion Tracking

1. Set up offline conversion import in Google Ads
2. Configure the analytics provider's Google Ads destination (see analytics stack file)
3. Map the `activate` event → Google Ads conversion action
4. Verify with a test conversion

Import method: analytics provider webhook → Google Ads Offline Conversions.

## Policy Restrictions

**Restricted industries:**
- **DeFi protocols, ICOs, token sales** — **BANNED**. Google Ads prohibits advertising decentralized finance protocols, initial coin offerings, and token sale events.
- **Crypto exchanges/wallets** — **RESTRICTED**. Requires FinCEN MSB registration + state money transmitter licenses (US) or MiCA CASP authorization (EU). Must apply for Google Ads Financial Products certification.
- **Gambling, pharma, weapons** — various restrictions apply; check Google Ads policies.

**Compliance notes:**
- Landing page must include clear disclaimers if promoting financial products
- Ads cannot make misleading claims about returns or guarantees
- Review [Google Ads Financial Products and Services policy](https://support.google.com/adspolicy/answer/2464998) before launching

## Cost Model

**CPC (Cost Per Click)** — you pay when a user clicks your ad.

- Bidding strategy (Phase 1): `maximize_clicks` — Google optimizes for volume
- After 15+ conversions: switch to `target_cpa` — Google optimizes for your target cost per acquisition
- `guardrails.max_cpc_cents` sets a ceiling on individual bid amounts

Budget structure:
- `daily_budget_cents`: daily spend cap
- `total_budget_cents`: total campaign cap (max 50000 / $500 without explicit override)
- `duration_days`: campaign length (matches `measurement_window`)

## Config Schema

The `ads.yaml` file for Google Ads uses:

```yaml
channel: google-ads
campaign_name: {name}-search-v{N}
project_name: {name}
landing_url: {deployed_url}

keywords:
  exact: [...]
  phrase: [...]
  broad: [...]
  negative: [...]

ads:
  - headlines: [...]    # 5+ headlines, 3-30 chars each
    descriptions: [...]  # 2+ descriptions, up to 90 chars each

# When idea.yaml has variants, use ad_groups instead of ads:
# ad_groups:
#   - variant: {slug}
#     landing_url: "{url}/v/{slug}?utm_source=google&utm_medium=cpc&utm_campaign={campaign}&utm_content={slug}"
#     ads:
#       - headlines: [...]
#         descriptions: [...]

budget:
  daily_budget_cents: ...
  total_budget_cents: ...
  duration_days: ...
  bidding_strategy: maximize_clicks

targeting:
  locations: [US]
  languages: [en]

conversions:
  primary_action: activate
  secondary_actions: [signup_complete]
  import_method: posthog_webhook

guardrails:
  max_cpc_cents: ...
  min_daily_clicks: 3
  auto_pause_rules: [...]

thresholds:
  expected_clicks: ...
  expected_signups: ...
  expected_activations: ...
  go_signal: "..."
  no_go_signal: "..."
```

## UTM Parameters

- `utm_source=google`
- `utm_medium=cpc`
- `utm_campaign={campaign_name}`
- `utm_content={variant_slug}` (when using variants)

## Setup Instructions

1. **Create Google Ads MCC** (Manager Account) — see `docs/google-ads-setup.md` for details
2. **Create a child account** for this MVP under the MCC
3. **Set up offline conversion import** in Google Ads → Tools → Conversions → Import
4. **Configure analytics destination** — see analytics stack file for provider-specific instructions
5. **Map events** — `activate` event → Google Ads conversion action
6. **Verify** — click your own ad, complete the activation flow, confirm the event appears in analytics

### Dashboard Filter

Filter analytics dashboard by `utm_source = "google"` to see paid traffic performance.
