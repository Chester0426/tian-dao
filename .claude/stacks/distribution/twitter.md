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
# Distribution: Twitter/X Ads
> Used when `/distribute` is run with channel `twitter`
> Assumes: None — distribution stacks create no source code or packages; they generate config only

## Ad Format Constraints

**Promoted Tweets:**
- Tweet text: up to 280 characters
- Minimum 2 tweet variations per campaign

**Optional Website Card:**
- Card title: up to 70 characters
- Card description: up to 200 characters
- Image: 800×418px (1.91:1) or 800×800px (1:1), max 5MB

When using Website Cards, the tweet text + card together form the ad creative.

## Targeting Model

**Interest and audience-based targeting** — ads appear in timelines of users matching your criteria.

Targeting options:
- **Interests** — select from Twitter's interest taxonomy (e.g., "Technology", "Cryptocurrency", "Finance")
- **Follower lookalikes** — target users similar to followers of specific handles (e.g., `@competitor1`, `@industry_leader`)
- **Timeline keywords** — target users who recently tweeted or engaged with specific keywords
- **Conversation topics** — target based on Twitter's conversation topics

Minimum targeting:
- At least 2 interests OR 2 follower lookalike handles OR 2 timeline keywords

## Click ID

**Parameter name:** `twclid` (Twitter Click ID)

Twitter auto-appends `twclid` to the landing URL when a user clicks an ad. Capture it on the landing page and include it in analytics events for conversion attribution.

## Conversion Tracking

1. Install the Twitter pixel (or use server-side conversion API)
2. Set up a Website Tag in Twitter Ads → Events Manager
3. Map the `activate` event → Twitter conversion event
4. Verify with a test conversion

Import method: Twitter Pixel (client-side) or Conversions API (server-side).

## Policy Restrictions

**Crypto-friendly:**
- **Crypto exchanges/wallets** — **ALLOWED**. Twitter permits advertising cryptocurrency exchanges and wallet services.
- **DeFi protocols** — **ALLOWED**. Decentralized finance products can be advertised on Twitter.
- **Token sales/ICOs** — **ALLOWED** with disclaimers. Include risk disclosures where required by local law.
- **NFTs** — **ALLOWED**.

**General restrictions:**
- Ads must not make misleading claims about returns or guarantees
- Landing page must match ad content (no bait-and-switch)
- Financial disclaimers required where mandated by local regulations
- Review [Twitter Ads Policies](https://business.twitter.com/en/help/ads-policies.html) before launching

## Cost Model

**CPE (Cost Per Engagement) or CPM (Cost Per Mille/1000 impressions):**

- **CPE**: pay when a user engages (click, retweet, like, reply)
- **CPM**: pay per 1000 impressions — better for awareness campaigns
- Recommended for MVPs: **CPE** — only pay for actual engagement

Budget structure:
- `daily_budget_cents`: daily spend cap
- `total_budget_cents`: total campaign cap
- `duration_days`: campaign length

Threshold calculation for CPM:
- impressions = budget / (CPM / 1000)
- clicks = impressions × estimated CTR

## Config Schema

The `ads.yaml` file for Twitter uses:

```yaml
channel: twitter
campaign_name: {name}-twitter-v{N}
project_name: {name}
landing_url: {deployed_url}

targeting:
  interests: [...]
  follower_lookalikes: [...]   # @handles of competitors/leaders
  timeline_keywords: [...]
  locations: [US]
  languages: [en]

tweets:
  - text: "..."       # up to 280 chars
    card:              # optional
      title: "..."     # up to 70 chars
      description: "..." # up to 200 chars
      image: "..."     # URL or path to 800x418px image

# When idea.yaml has variants, include utm_content in landing URLs:
# tweets:
#   - text: "..."
#     variant: {slug}
#     landing_url: "{url}/v/{slug}?utm_source=twitter&utm_medium=paid_social&utm_campaign={campaign}&utm_content={slug}"

budget:
  daily_budget_cents: ...
  total_budget_cents: ...
  duration_days: ...
  bidding_strategy: cpe  # or cpm

conversions:
  primary_action: activate
  secondary_actions: [signup_complete]
  import_method: twitter_pixel

guardrails:
  max_cpe_cents: ...     # max cost per engagement
  auto_pause_rules: [...]

thresholds:
  expected_impressions: ...
  expected_clicks: ...
  expected_signups: ...
  expected_activations: ...
  go_signal: "..."
  no_go_signal: "..."
```

## UTM Parameters

- `utm_source=twitter`
- `utm_medium=paid_social`
- `utm_campaign={campaign_name}`
- `utm_content={variant_slug}` (when using variants)

## Setup Instructions

1. **Create Twitter Ads account** at [ads.twitter.com](https://ads.twitter.com)
2. **Add payment method** — credit card or IO
3. **Install Twitter pixel** on the landing page (or configure Conversions API)
4. **Create conversion event** — Events Manager → New Event → Website visits / Custom event
5. **Map events** — `activate` event → Twitter conversion event
6. **Verify** — use Twitter's Event Manager to confirm pixel is firing

### Dashboard Filter

Filter analytics dashboard by `utm_source = "twitter"` to see paid traffic performance.
