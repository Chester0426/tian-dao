# Assayer — 从零构建 Session Prompts

> 20 sessions + 5 checkpoints。每个 prompt 是一个独立的 Claude Code 指令。
> 每个 session 对应一个新的 conversation。每个 session 产出 1+ PRs。
> 开始任何 session 前，先读 `docs/assayer-product-design.md`、`docs/ux-design.md` 和 `docs/CONVENTIONS.md`。

## 设计原则

1. **依赖驱动** — session 顺序由数据依赖图决定，不存在 forward reference
2. **合约导向** — 每个 session 声明输入/输出合约（文件 + export 签名）；下一个 session 验证前序合约
3. **从零开始** — 这是全新构建（`git init`），不存在旧代码
4. **最小充分** — 只构建 `experiment.yaml` 和两个设计文档中明确定义的内容
5. **可验证** — 每个 session 以 `npm run build` 零错误结束
6. **关键路径有代码锚点** — 计费、安全、数据一致性相关的实现不依赖 AI 推导，提供确定性代码片段

## Session Preamble Template

每个 session 开始时隐式执行以下步骤（不需要在每个 prompt 中重复）：

1. 读 `docs/assayer-product-design.md` 和 `docs/ux-design.md`（整体理解）
2. 读 `docs/CONVENTIONS.md`（代码风格锚点）
3. 读 `experiment/experiment.yaml`（scope lock）
4. **合约验证** — 检查前序 session 的输出合约（不只是文件存在，验证导出签名）：
   - 读取前序 session 声明的 **输出合约** 中的每个文件
   - 验证关键 export 存在且签名匹配（如 `export function specReducer(state: SpecState, event: SpecStreamEvent): SpecState`）
   - 如果合约不满足，先修复再继续

## Output Contract Format

每个 session 的 **输出** 段现在声明两种类型：
- **文件输出**：文件路径 + 关键 export 签名
- **DB 输出**：table 名 + 关键 column

后续 session 在 preamble 中验证这些合约。这消除了 "文件存在但签名不匹配" 的累积偏移风险。

## Checkpoint Template

Checkpoints（标记为 [CP]）不是 sessions — 它们不产出 PRs。每个 checkpoint 执行以下验证：

1. `npm run build` 零错误
2. `npx vitest run` 通过（如有 tests）
3. 前序 sessions 的所有输出文件存在
4. 无 TypeScript 编译错误（`npx tsc --noEmit`）
5. 关键 API routes 的 curl smoke test（如适用）
6. 生成 checkpoint report（markdown），记录：通过/失败项、发现的问题、修复建议

Checkpoint 失败时：修复问题后重新验证，不继续下一个 phase。

## 进度追踪

| Session | Status | PR / Commit | Notes |
|---------|--------|-------------|-------|
| 0 | TODO | — | mvp-template 补全（在 mvp-template repo 执行）|
| 1 | TODO | — | experiment.yaml + EVENTS.yaml (manual) |
| 2 | TODO | — | /bootstrap |
| 2.5 | TODO | — | Style Contract (CONVENTIONS.md) |
| 3 | TODO | — | DB schema + RLS + Auth + Core CRUD |
| 4 | TODO | — | SSE Spec Stream + Anonymous Specs + Claim |
| [CP1] | TODO | — | Checkpoint: Foundation + Data Layer |
| 5 | TODO | — | Landing + Assay + Signup Gate |
| 6a | TODO | — | Build & Launch Flow |
| 6b | TODO | — | Experiment Page + Change Request + Alerts |
| [CP2] | TODO | — | Checkpoint: UI Core |
| 7 | TODO | — | Lab + Verdict + Compare + Settings |
| 8 | TODO | — | Billing + Operations |
| [CP3] | TODO | — | Checkpoint: Full UI + Billing |
| 9a | TODO | — | Skill Execution API + Realtime (Vercel) |
| 9b | TODO | — | Docker + skill-runner.js (Cloud Run) |
| 10 | TODO | — | Distribution System |
| [CP4] | TODO | — | Checkpoint: Infrastructure |
| 11 | TODO | — | Metrics Cron + Alerts + Verdict Engine + Notifications |
| 12a | TODO | — | CSS Tokens + 6 Mobile Components |
| 12b | TODO | — | Animation Choreography + Per-Page Mobile |
| 12c | TODO | — | Visual Verification |
| [CP5] | TODO | — | Checkpoint: Complete Application |
| 13 | TODO | — | /harden + /verify |
| 14 | TODO | — | /deploy + Validation |

---

## Phase 0: Template Prerequisites

### Session 0 — mvp-template 补全（在 mvp-template repo 执行）

**目标**：补全 mvp-template 中 Assayer 所依赖的 8 项能力：4 个 distribution stack files + 4 个 skill 增强。

**为什么这是 Session 0**：Assayer Session 10（Distribution System）会调用 `/distribute` skill，该 skill 读取 `stacks/distribution/*.md` 生成 per-channel config。如果这些 stack files 不存在，Session 10 无法工作。同理，Session 2 的 `/bootstrap` 需要 vitest co-install 逻辑（Assayer 用 `testing: playwright` + `quality: production`，需要两套 test runner 共存）。Session 9a 的 skill-runner 需要 `/iterate` 输出 iterate-manifest.json，Session 4 的 spec stream 需要 `/spec` 共享 spec-reasoning.md 规则。

**输入**：mvp-template 仓库（当前 main 分支）

**输出合约**（Assayer Session 2/9a/10 会验证这些文件存在且内容符合格式）：
```
.claude/stacks/distribution/meta-ads.md        → frontmatter 含 assumes/packages/files/env/ci_placeholders/clean 字段
.claude/stacks/distribution/twitter-organic.md  → frontmatter 全空（config-only），含 API Procedure section
.claude/stacks/distribution/reddit-organic.md   → frontmatter 全空（config-only），含 API Procedure section
.claude/stacks/distribution/email-campaign.md   → frontmatter env.server 含 RESEND_API_KEY
.claude/commands/bootstrap.md                   → 含 "Vitest co-installation" 段落（搜索此字符串验证）
.claude/commands/spec.md                        → 含 "spec-reasoning.md" 引用 + STOP points
.claude/commands/iterate.md                     → 含 "iterate-manifest.json" 输出定义 + per-hypothesis verdicts
.claude/commands/distribute.md                  → 含 6 adapters 列表 + channel selection logic
```

**注意**：此 session 在 mvp-template repo 中执行，不在 Assayer repo 中。

**Prompt**:

```
这是 mvp-template 的补全任务。Assayer（一个基于此 template 构建的产品）依赖以下 8 项尚不存在的能力。
不要修改现有功能的行为 — 只新增文件或在现有文件中追加内容。

## Phase 1: 发现 — 读取所有参考文件

先读以下文件，理解现有格式和约定（不修改）：

1. `.claude/stacks/distribution/google-ads.md` — distribution stack 的标准格式（frontmatter 结构 + section 顺序）
2. `.claude/stacks/distribution/twitter.md` — Twitter Ads stack（区分 ads vs organic）
3. `.claude/stacks/distribution/reddit.md` — Reddit Ads stack（区分 ads vs organic）
4. `.claude/stacks/email/resend.md` — email stack 格式（区分 transactional vs campaign）
5. `.claude/commands/bootstrap.md` — 当前 bootstrap 流程（找到 Phase 2 "Production quality check" 段的插入位置）
6. `.claude/commands/spec.md` — 当前 /spec skill
7. `.claude/commands/iterate.md` — 当前 /iterate skill
8. `.claude/commands/distribute.md` — 当前 /distribute skill（确认现有 adapter 数量）
9. `.claude/stacks/testing/vitest.md` — vitest stack 格式（bootstrap.md 修改需要引用）
10. `.claude/patterns/spec-reasoning.md` — spec 推理规则（spec.md 修改需要引用）

**格式规则**：从 google-ads.md 提取精确的 frontmatter schema 和 section 顺序。所有新建的 distribution stack files 必须与 google-ads.md 保持相同的 frontmatter 字段集和 section 命名模式。

## Phase 2: 实施 — 分 3 个 PR

### PR 1: 4 个 distribution stack files

branch: `feat/distribution-stacks`

#### 1a. 新建 `.claude/stacks/distribution/meta-ads.md`

Meta Marketing API v21.0。**与 google-ads.md 的关键区别**：targeting 是 interest-based（非 keyword-based），conversion tracking 走 Meta Pixel + Conversions API（非 Google Tag）。

Frontmatter（所有字段必须存在，即使为空 — distribution stacks 是 config-only）：
```yaml
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
```

必须包含的 Sections（名称严格匹配 google-ads.md 的 section 命名模式）：
- **Ad Format Constraints**: Single image（1200×628, primary text ≤125 chars, headline ≤40 chars）, Carousel（2-10 cards）, Video（15-60s）
- **Targeting Model**: Interest-based + demographic + lookalike audiences + custom audiences (Pixel) + location/language
- **Click ID**: fbclid（自动追加）
- **Conversion Tracking**: Meta Pixel（client-side: `fbq('track','Lead')`）+ Conversions API（server-side: `POST graph.facebook.com/v21.0/{pixel_id}/events`）。建议 server-side 以应对 iOS 14.5+
- **Policy Restrictions**: 金融广告需 disclaimers，crypto 需 written permission，ad review ~24h
- **Cost Model**: CPM 或 CPC，bidding LOWEST_COST（初始）→ COST_CAP（50+ conversions 后）。MVP 建议 CPC + LOWEST_COST
- **Config Schema** (ads.yaml):
  ```yaml
  channel: meta-ads
  campaign:
    name: string
    objective: OUTCOME_TRAFFIC
    budget_cents_per_day: integer
    start_date: date
    end_date: date
  adset:
    targeting: { interests, demographics, locations, languages }
    bid_strategy: LOWEST_COST
    optimization_goal: LINK_CLICKS
  ad:
    creative: { image_url, primary_text, headline, cta: LEARN_MORE }
    tracking: { pixel_id, utm_source: facebook, utm_medium: paid_social }
  ```
- **UTM**: `utm_source=facebook`, `utm_medium=paid_social`
- **Setup Instructions**: Create Meta Business Manager → add ad account → install Meta Pixel → Create Facebook Login app → configure OAuth (`ads_management` scope) → test in Sandbox
- **API Procedure**（8 步）:
  1. Get access token via Facebook Login OAuth
  2. Get ad account ID: `GET /v21.0/me/adaccounts`
  3. Create campaign: `POST /v21.0/act_{ad_account_id}/campaigns`
  4. Create ad set: `POST /v21.0/act_{ad_account_id}/adsets`（含 targeting spec）
  5. Upload image: `POST /v21.0/act_{ad_account_id}/adimages`
  6. Create ad creative: `POST /v21.0/act_{ad_account_id}/adcreatives`
  7. Create ad: `POST /v21.0/act_{ad_account_id}/ads`（关联 creative + adset）
  8. Set campaign status ACTIVE: `POST /v21.0/{campaign_id} { status: 'ACTIVE' }`
- **Error Handling**（表格格式）:

  | Error | Action |
  |-------|--------|
  | OAuthException | refresh token |
  | #1 Unknown error | retry with backoff |
  | #17 Rate limit | exponential backoff |
  | #100 Invalid param | check targeting spec |

#### 1b. 新建 `.claude/stacks/distribution/twitter-organic.md`

Organic posting via X API v2。**不是** X Ads API — ads 在 `twitter.md` 已覆盖。此文件覆盖免费有机发布。

Frontmatter: 与 google-ads.md 完全相同结构（所有字段为空 — config-only）。

必须包含的 Sections：
- **Post Format**: Tweet thread（最多 25 tweets, 每条 ≤280 chars）, 支持 media upload（images, video）, URL 自动缩短为 t.co（消耗 23 chars）
- **Auth**: OAuth 2.0 PKCE, scopes: `tweet.write`, `tweet.read`, `users.read`。Basic tier 即可（不需要 Elevated access）
- **Rate Limits**: `POST /2/tweets` — 300/3h per app, 200/15min per user; media upload — 615/15min
- **Measurement**: X API v2 free tier 无 organic analytics API。使用 UTM params + PostHog 追踪。每条 tweet link 附加 `utm_source=twitter&utm_medium=organic`
- **Config Schema** (organic.yaml):
  ```yaml
  channel: twitter-organic
  thread:
    - { text: string, media_url?: string }
  reply_settings: "mentionedUsers"
  ```
- **Setup**: X Developer Portal → create Project + App → enable OAuth 2.0 → callback URL → generate keys
- **API Procedure**:
  1. Post first tweet: `POST /2/tweets { text: "..." }`
  2. Thread replies: `POST /2/tweets { text: "...", reply: { in_reply_to_tweet_id: prev_id } }`（循环）
  3. Media upload（if applicable）: `POST /2/media/upload`（chunked）→ get `media_id` → include in tweet payload
- **Notes**: 不要使用 automated thread bots pattern（违反 X Platform Manipulation Policy）。发布间隔建议 ≥30s 以避免质量过滤

#### 1c. 新建 `.claude/stacks/distribution/reddit-organic.md`

Organic posting via Reddit API。**不是** Reddit Ads API — ads 在 `reddit.md` 已覆盖。

Frontmatter: 全空（与 twitter-organic.md 相同结构）。

必须包含的 Sections：
- **Post Format**: Link post 或 Self post。Title ≤300 chars。Self post body 支持 Markdown
- **Subreddit Rules**: 每个 subreddit 有独立 self-promotion 限制。发布前 `GET /r/{subreddit}/about/rules` 检查。常见限制: karma 门槛, 账号年龄, 10:1 participation ratio
- **Flair**: 某些 subreddit 要求 flair。`GET /r/{subreddit}/api/link_flair` → 选择最匹配的 flair
- **Auth**: OAuth 2.0, scopes: `submit`, `read`, `flair`。User-Agent 必须包含 app name + version
- **Rate Limits**: 10 requests/min（全局），每 subreddit 发帖间隔 ≥10min
- **Measurement**: UTM params in link URL。Reddit 不提供 post analytics API
- **Config Schema** (organic.yaml):
  ```yaml
  channel: reddit-organic
  posts:
    - { subreddit: string, title: string, type: "link"|"self", url?: string, body?: string, flair_id?: string }
  ```
- **Setup**: reddit.com/prefs/apps → create app → get client_id + secret → OAuth 2.0 authorization
- **API Procedure**:
  1. Get access token: `POST /api/v1/access_token`
  2. Get subreddit rules: `GET /r/{subreddit}/about/rules`
  3. Get flairs: `GET /r/{subreddit}/api/link_flair_v2`
  4. Submit post: `POST /api/submit { sr, kind: "link"|"self", title, url|text, flair_id? }`
- **Notes**: Reddit 社区对 spam 极度敏感。organic posts 必须提供 genuine value。建议: "Show HN" 式分享 + 后续 comment 参与

#### 1d. 新建 `.claude/stacks/distribution/email-campaign.md`

Broadcast email distribution via Resend API。**与 `stacks/email/resend.md` 不同** — 那个是 transactional email（welcome, password reset），这个是 distribution campaign（launch announcements, outreach）。

Frontmatter: `env.server: [RESEND_API_KEY]`（其余全空）。

必须包含的 Sections：
- **Batch Send**: `POST /emails/batch`, max 100 recipients per call。大列表分批发送
- **Audience Management**: Resend Audiences API（`POST /audiences`, `POST /audiences/{id}/contacts`）或 BYO email list
- **Email Format**: HTML email, 必须包含: unsubscribe link（Resend 自动追加 if using Audiences）, physical address（CAN-SPAM）
- **CAN-SPAM Compliance**: physical address in footer, functional unsubscribe, no misleading headers/subjects
- **Tracking**: UTM params in all links（`utm_source=email`, `utm_medium=campaign`, `utm_campaign={slug}`）。Resend 提供 open/click tracking（webhook events: `email.opened`, `email.clicked`）
- **Config Schema** (campaign.yaml):
  ```yaml
  channel: email-campaign
  campaign:
    subject: string
    from: string
    reply_to: string
    html_template: string
    audience_id?: string
    contacts?: string[]
    utm_params: { utm_source: email, utm_medium: campaign, utm_campaign: string }
  ```
- **Setup**: Resend account → verify sending domain（DNS records）→ create API key → create Audience
- **API Procedure**:
  1. Create/get audience: `POST /audiences` or `GET /audiences`
  2. Add contacts: `POST /audiences/{id}/contacts { email, first_name?, last_name? }`
  3. Batch send: `POST /emails/batch [{ from, to, subject, html, headers: { "X-Entity-Ref-ID": unique_id } }]`
  4. Track delivery: Resend webhook → `email.delivered` / `email.bounced` / `email.complained`
- **Notes**: 不是 newsletter 平台。用于实验 launch announcement / distribution reach。每个 experiment 最多 2-3 batch emails

**PR 1 验证**：
1. 4 个新文件都存在于 `.claude/stacks/distribution/`
2. 每个文件的 frontmatter 字段集与 `google-ads.md` 完全一致（字段名 + 嵌套结构）
3. 每个文件都有 Config Schema section + API Procedure section
4. `email-campaign.md` 的 `env.server` 包含 `RESEND_API_KEY`；其他 3 个 `env` 全空

### PR 2: bootstrap.md + spec.md 修改

branch: `feat/bootstrap-spec-enhancements`

#### 2a. 修改 `.claude/commands/bootstrap.md` — vitest co-install

**插入位置**：找到字符串 `"scaffold-wire: run test discovery checkpoint"`，在其所在段落之后插入新段落。如果找不到该字符串，找到 Phase 2 中包含 "Production quality check" 或 "quality: production" 的位置，在相关检查列表中追加。

**插入内容**（原文，不改动措辞）：

```markdown
**Vitest co-installation**: When `quality: production` is set AND `stack.testing` is NOT `vitest` (e.g., `testing: playwright`):
- Also install `vitest` and `@vitest/coverage-v8` as dev dependencies
- Create `vitest.config.ts` using the template from `.claude/stacks/testing/vitest.md`
- This ensures specification tests (TDD per `patterns/tdd.md`) can run alongside E2E tests
- scaffold-setup handles this: check if vitest.config.ts exists before creating
- Two test runners coexist: `npx playwright test` for E2E, `npx vitest run` for spec tests
```

**为什么**：Assayer 使用 `testing: playwright`（E2E）+ `quality: production`（需要 vitest 做 spec tests）。没有这段逻辑，bootstrap 不会安装 vitest，Session 3 的 unit tests 无法运行。

#### 2b. 修改 `.claude/commands/spec.md` — 导入 spec-reasoning.md

读取 `.claude/patterns/spec-reasoning.md`，理解其 6 个 reasoning section 的结构。

修改 spec.md，使 /spec skill：
- 在执行推理时 import `.claude/patterns/spec-reasoning.md` 作为 shared reasoning rules（在文件中添加读取指令）
- 包装为带 3 个 STOP points 的交互式流程：
  1. Pre-flight Reasoning → **STOP**（等待用户确认方向）
  2. Hypothesis Quality Review → **STOP**（等待用户审核假设）
  3. Variant Distinctiveness Review → **STOP**（等待用户选择变体策略）
- Output format: `experiment.yaml`（CLI 不使用 `>>>EVENT:` — 那是 SSE streaming 专用格式）
- Reuse spec-reasoning.md 的 6 个 reasoning sections，不重复定义

**PR 2 验证**：
1. `bootstrap.md` 中搜索 `"Vitest co-installation"` 能找到完整段落
2. `spec.md` 中搜索 `"spec-reasoning.md"` 能找到引用
3. `spec.md` 中搜索 `"STOP"` 能找到 3 个 stop points

### PR 3: iterate.md + distribute.md 修改

branch: `feat/iterate-distribute-enhancements`

#### 3a. 修改 `.claude/commands/iterate.md` — per-hypothesis verdicts + manifest

增强 /iterate skill，添加以下能力：

**Per-hypothesis verdicts**：每个 hypothesis 独立判定，不仅仅是 experiment-level verdict。
- 判定值：`CONFIRMED` / `REJECTED` / `INCONCLUSIVE`
- 每个 hypothesis 独立评估，基于其关联的 metrics

**Archetype-specific funnel mapping**（当前 iterate 只处理 web-app funnel，增加 service 和 cli）：
- service: REACH = API adoption rate, DEMAND = integration requests, ACTIVATE = first successful API call, MONETIZE = API key upgrades, RETAIN = monthly active integrations
- cli: REACH = install rate, DEMAND = daily active usage, ACTIVATE = first successful command, MONETIZE = pro feature adoption, RETAIN = update rate

**Output 定义** — iterate-manifest.json:
```json
{
  "experiment_id": "<experiment.yaml name>",
  "round": 1,
  "verdict": "<SCALE|KILL|PIVOT|REFINE|TOO_EARLY>",
  "bottleneck": {
    "stage": "<funnel stage name>",
    "conversion": "<percentage>",
    "diagnosis": "<one-line diagnosis>",
    "dimension": "<REACH|DEMAND|ACTIVATE|MONETIZE|RETAIN>",
    "ratio": 0.65,
    "recommendation": "<dimension-specific recommendation>"
  },
  "recommendations": [
    {
      "action": "<what to do>",
      "skill": "</change ...>",
      "expected_impact": "<which metric improves>"
    }
  ],
  "variant_winner": "<slug or null>",
  "analyzed_at": "<ISO 8601>",
  "hypothesis_verdicts": [
    {
      "hypothesis_id": "<id from spec-manifest>",
      "metric_formula": "<metric.formula from hypothesis>",
      "metric_operator": "<metric.operator from hypothesis>",
      "computed_value": "<result of evaluating formula against event counts>",
      "threshold": "<metric.threshold from hypothesis>",
      "verdict": "<CONFIRMED|REJECTED|INCONCLUSIVE|BLOCKED>",
      "blocked_by": "<parent hypothesis id or null>",
      "sample_size": 0,
      "confidence_level": "<insufficient data|directional signal|reliable|high confidence>"
    }
  ],
  "funnel_scores": {
    "reach": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<hypothesis|events-yaml>" },
    "demand": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<hypothesis|events-yaml>" },
    "activate": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<hypothesis|events-yaml>" },
    "monetize": { "score": 0, "confidence": "<tag>", "sample_size": 0, "threshold_source": "<hypothesis|events-yaml>" },
    "retain": null
  }
}
```

**Input**：读取 `spec-manifest.json`（由 skill-runner.js 从 Supabase 数据生成）

#### 3b. 修改 `.claude/commands/distribute.md` — 6-adapter architecture

更新为 6-adapter architecture（确认现有 adapter 数量后追加缺失的 adapters）：

**6 adapters 完整列表**：
1. `twitter-organic` → 读取 `stacks/distribution/twitter-organic.md`
2. `reddit-organic` → 读取 `stacks/distribution/reddit-organic.md`
3. `email-resend` → 读取 `stacks/distribution/email-campaign.md`
4. `google-ads` → 读取 `stacks/distribution/google-ads.md`（已存在）
5. `meta-ads` → 读取 `stacks/distribution/meta-ads.md`
6. `twitter-ads` → 读取 `stacks/distribution/twitter.md`（已存在）

**Channel selection logic**：
- Free/PAYG plans → organic only（twitter-organic, reddit-organic, email-resend）
- Pro/Team plans → all 6 channels
- 叠加 experiment type + budget 约束

**Budget allocation**（AI-suggested split based on experiment type + target audience）：
- Default split（no history）: 40% Google Ads, 30% Meta Ads, 15% Twitter Ads, 15% organic
- Organic-only split: 40% Twitter, 35% Reddit, 25% Email

**Config generation**: 每个 adapter 生成对应的 `ads.yaml` / `organic.yaml` / `campaign.yaml`，从 experiment data 中填充字段。

**PR 3 验证**：
1. `iterate.md` 中搜索 `"iterate-manifest.json"` 能找到 output 定义
2. `iterate.md` 中搜索 `"hypothesis_verdicts"` 或 `"CONFIRMED"` 能找到 verdict 逻辑
3. `iterate.md` 中搜索 `"service:"` 和 `"cli:"` 能找到 archetype-specific funnel mapping
4. `distribute.md` 中搜索 `"meta-ads"` 和 `"twitter-organic"` 能找到 6 adapters
5. `distribute.md` 中搜索 `"Free/PAYG"` 或 `"organic only"` 能找到 channel selection logic

## Phase 3: 最终验证

所有 3 个 PR merge 后，运行以下验证：

1. 文件计数: `ls .claude/stacks/distribution/` 应包含 meta-ads.md, twitter-organic.md, reddit-organic.md, email-campaign.md（4 个新文件 + 已有文件）
2. Frontmatter 一致性: 每个新 distribution stack file 的 frontmatter 字段集与 google-ads.md 完全一致
3. 字符串搜索验证（验证修改是否到位）:
   - `grep -l "Vitest co-installation" .claude/commands/bootstrap.md` → 命中
   - `grep -l "spec-reasoning.md" .claude/commands/spec.md` → 命中
   - `grep -l "iterate-manifest.json" .claude/commands/iterate.md` → 命中
   - `grep -l "meta-ads" .claude/commands/distribute.md` → 命中
4. 无 build 验证（这些都是 .md 文件，无 npm run build）
```

---

## Phase 1: Foundation

### Session 1 — Repo + experiment.yaml + EVENTS.yaml (manual)

**目标**：创建仓库，手动编写 experiment.yaml 和 EVENTS.yaml。

**输入**：无（从零开始）

**输出**：
- `experiment/experiment.yaml` — 完整的 Assayer 平台 spec
- `experiment/EVENTS.yaml` — analytics 事件定义
- Git repo initialized

**输出合约**（Session 2 验证）：
```
experiment/experiment.yaml  → name: assayer, type: web-app, level: 3, quality: production, stack.database: supabase
experiment/EVENTS.yaml      → 含 events (flat map with funnel_stage), global_properties sections
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md 和 docs/ux-design.md。

这是 Assayer 平台本身（不是用户的实验）的 experiment.yaml。根据两个设计文档，手动编写 experiment.yaml：

1. Identity:
   - name: assayer
   - type: web-app
   - level: 3（Product — 需要 auth + payments）
   - quality: production

2. Stack:
   services:
     - name: app
       runtime: nextjs
       hosting: vercel
       ui: shadcn
       testing: playwright
   database: supabase
   auth: supabase
   auth_providers: [google, github]
   analytics: posthog
   payment: stripe
   ai: anthropic

3. Behaviors — 从 product-design.md Section 5 的 API routes 和 ux-design.md 的 Screen-by-Screen Specification 推导：
   - 每个 page 至少一个 behavior
   - 每个 API route group 至少一个 behavior
   - actor: system 用于 cron jobs、webhooks、Cloud Run Jobs
   - tests[] 数组用于 Quality Gate

4. Golden path — 从 ux-design.md Information Architecture 推导：
   landing → assay → launch → experiment → verdict → lab → compare → settings
   注意：signup 不是独立页面，是 Assay 页面上的 modal overlay（ux-design.md Screen 3）。
   compare 和 settings 是补充页面，包含在 golden_path 中以确保 bootstrap 创建对应 page.tsx。

5. Variants — Assayer 自身的 A/B messaging：
   - "verdict-machine": "Know if it's gold before you dig."
   - "time-saver": "Stop building the wrong thing."
   - "data-driven": "Data-backed verdicts in days, not months."

6. Funnel thresholds — 这是 Assayer 平台自身的验证：
   - REACH: Ad CTR > 2%
   - DEMAND: Signup rate > 5%
   - ACTIVATE: Spec completion rate > 40%
   - MONETIZE: Pro conversion > 3%
   - RETAIN: 30-day return > 30%

7. 同时编写 EVENTS.yaml，定义：
   - events flat map with funnel_stage tags（visit_landing, cta_click, signup_complete, checkout_started, payment_complete, etc.）
   - payment events have requires: [payment]
   - global_properties: { experiment_name: "assayer", experiment_id: "platform" }
   - 自定义 events：spec_generated, experiment_created, verdict_delivered, distribution_launched

8. Pages 列表（来自 product-design.md Section 6 Pages）：
   landing, assay, launch, experiment, verdict, lab, compare, settings
   （共 8 个 page.tsx。signup 是 modal overlay on /assay，不是独立页面）

验证：experiment.yaml 格式正确，behaviors 覆盖所有 pages 和 API route groups。
```

---

### Session 2 — /bootstrap

**目标**：用 /bootstrap 生成完整脚手架。

**输入**：Session 1 的 `experiment/experiment.yaml` + `experiment/EVENTS.yaml`

**输出**：
- 完整的 Next.js 项目结构
- 所有 pages 的 stub
- shadcn/ui 组件安装
- PostHog analytics 集成
- Playwright 测试 stub
- Supabase 初始配置
- `.env.example` 包含所有环境变量

**输出合约**（Session 2.5 验证）：
```
src/app/page.tsx                     → exists (Landing page stub)
src/app/assay/page.tsx               → exists (Assay page stub)
src/app/launch/[id]/page.tsx         → exists (Launch page stub)
src/app/experiment/[id]/page.tsx     → exists (Experiment page stub)
src/app/verdict/[id]/page.tsx        → exists (Verdict page stub)
src/app/lab/page.tsx                 → exists (Lab page stub)
src/app/compare/page.tsx             → exists (Compare page stub)
src/app/settings/page.tsx            → exists (Settings page stub)
.env.example                         → exists with NEXT_PUBLIC_SUPABASE_URL
package.json                         → contains "next", "react" in dependencies
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 experiment/experiment.yaml 和 experiment/EVENTS.yaml。

运行 /bootstrap。

Bootstrap 完成后验证：
1. npm run build 零错误
2. 所有 8 个 pages 有对应的 page.tsx（landing, assay, launch, experiment, verdict, lab, compare, settings）
3. analytics 库已配置，PostHog 集成就绪
4. .env.example 包含所有需要的环境变量（包括 ANTHROPIC_API_KEY）
5. Playwright 配置就绪

注意：bootstrap 会创建 Supabase 初始 migration。后续 Session 3 会添加完整的 17-table schema。
```

---

### Session 2.5 — Style Contract (CONVENTIONS.md)

**目标**：建立代码风格锚点，确保 14 个后续 session 的实现一致性。

**输入**：Session 2 的 bootstrap scaffold

**输出**：
- `docs/CONVENTIONS.md` — 12 sections 的代码约定文档

**输出合约**（Session 3 验证）：
```
docs/CONVENTIONS.md → exists with 12 sections (API Route Pattern through Migration Convention)
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读当前项目中已有的代码模式（如果 bootstrap 已生成 src/lib/ 下的文件）。

创建 docs/CONVENTIONS.md，包含 12 个 section，codify 以下 Assayer-specific patterns：

1. API Route Pattern — withErrorHandler(withAuth(...)) 组合，await context.params
2. Supabase Query Safety — 显式列列表，ownership checks
3. Zod Schema Conventions — .max() on strings，命名规范，export types
4. Error Response Shape — canonical { error: { code, message, details } }
5. TypeScript Type Locations — types.ts vs *-schemas.ts
6. Status Transitions — VALID_STATUS_TRANSITIONS map，validate before update
7. Test Conventions — colocated files，describe/it/expect，@/ alias
8. Import Alias — always @/，never ../../
9. Soft Delete Pattern — archived_at timestamp，never hard-delete user rows
10. Analytics Events — typed wrappers，never call PostHog directly
11. Naming — files kebab-case, components PascalCase, DB snake_case, schemas camelCase+Schema
12. Migration Convention — one per PR，DROP+ADD for CHECK constraints

这些约定补充 CLAUDE.md 的 template-level 规则 — CLAUDE.md 覆盖通用模板规则，
CONVENTIONS.md 覆盖 Assayer-specific 实现 patterns。

每个 section 包含：规则描述 + 代码示例 + 反面示例（如适用）。

npm run build 零错误（无代码修改，仅文档）。
```

---

## Phase 2: Data Layer

### Session 3 — 完整 DB Schema + RLS + Auth Middleware + Core CRUD APIs

**目标**：建立完整的数据层 — 17 张表、RLS policies、auth middleware、核心 CRUD API routes。

**输入**：Session 2 的 bootstrap scaffold

**输出**：
- 17 张表的 Supabase migration（product-design.md Section 6 完整）
- 所有表的 RLS policies
- `withAuth` middleware（验证 Supabase JWT，返回 user）
- `withErrorHandler` wrapper（统一 error schema）
- Rate limiting utility
- Core CRUD API routes（experiments, hypotheses, variants, rounds）
- Supabase RPC function `decrement_payg_balance`（原子递减 PAYG 余额）
- Supabase trigger function `create_user_billing_on_signup`（新用户自动创建 billing 行）

**输出合约**（后续 session 验证）：
```
src/lib/api-error.ts        → export function withErrorHandler(handler): NextResponse
src/lib/api-auth.ts          → export function withAuth(handler): (request, context) => Promise<NextResponse>
src/lib/rate-limit.ts        → export function rateLimit(key, limit, windowMs): Promise<{success, remaining}>
src/lib/supabase-server.ts   → export function createServerClient(): SupabaseClient
vitest.config.ts             → exists
supabase/migrations/         → ≥1 .sql file with 17 CREATE TABLE statements
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 5（API Routes）和 Section 6（Data Model）。

用 /change 实现完整数据层。这是一个大的 change，分几个 PR：

## PR 1: Error Schema + Auth Middleware + Rate Limiting

1. 创建 `src/lib/api-error.ts`：
   - ErrorResponse type: { error: { code, message, details } }
   - codes: validation_error, not_found, unauthorized, rate_limited, ai_error, internal_error
   - withErrorHandler HOF wrapping route handlers

2. 创建 `src/lib/api-auth.ts`：
   - withAuth(handler) — 从 request headers 提取 Supabase JWT，验证，返回 user
   - withAuth wraps handler signature: (request, context, user)
   - context.params 是 Promise<Record<string, string>>

3. 创建 `src/lib/rate-limit.ts`：
   - 基于 IP 的 rate limiting（Vercel serverless 无共享内存，用 Supabase 或 in-memory Map + cleanup）
   - 配置：auth routes 5/min, spec/stream 3/24h per session_token, general 30/min

4. 创建 vitest 配置（quality: production 要求 specification tests，Playwright stack 不创建 vitest.config.ts）：
   - npm install -D vitest @vitest/coverage-v8
   - 创建 vitest.config.ts（添加 @ → src/ alias）
   - 为 api-error.ts, api-auth.ts, rate-limit.ts 编写 unit tests

## PR 2: 完整 DB Schema（17 tables）

创建 Supabase migration，包含 product-design.md Section 6 的所有 17 张表：

1. anonymous_specs — 匿名 spec 暂存（24h TTL）
2. experiments — 实验主表
3. experiment_rounds — 多轮 REFINE 支持
4. hypotheses — 假设
5. hypothesis_dependencies — 假设依赖关系
6. research_results — 研究结果
7. variants — A/B 变体
8. experiment_metric_snapshots — 时序指标快照
9. experiment_decisions — verdict 历史
10. experiment_alerts — 告警（7 种 alert_type，包括 bug_auto_fixed）
11. notifications — 通知（7 种 trigger_type，包括 bug_auto_fixed）
12. ai_usage — AI 使用追踪
13. user_billing — 用户计费（plan, PAYG balance, pool counters）
14. operation_ledger — 操作账本
15. skill_executions — Cloud Run Jobs 追踪
16. oauth_tokens — 分发渠道 OAuth tokens
17. distribution_campaigns — 分发 campaigns

注意：所有表启用 RLS。Policy 模式：
- 直属 user_id 的表: auth.uid() = user_id
- 通过 experiment_id 关联的表: experiment_id IN (SELECT id FROM experiments WHERE user_id = auth.uid())
- anonymous_specs: 无 RLS（匿名访问）

包含所有 indexes、CHECK constraints、updated_at triggers，完全匹配 product-design.md Section 6 的 SQL。

## PR 2b: Supabase RPC + Triggers（关键代码锚点）

**这些是计费正确性的基础，必须作为 migration 的一部分创建。**

### 1. 新用户自动创建 user_billing 行

```sql
-- Auto-create user_billing row when a new user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.create_user_billing_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_billing (user_id, plan, payg_balance_cents)
  VALUES (NEW.id, 'payg', 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_billing_on_signup();
```

**为什么不在 app logic 中创建**：如果 claim API 或任何其他路径在 user_billing 行存在之前被调用，会产生 FK violation 或 null reference。Trigger 保证原子性。

### 2. PAYG 余额原子递减 RPC

```sql
-- Atomic PAYG balance decrement (prevents race conditions)
CREATE OR REPLACE FUNCTION public.decrement_payg_balance(
  p_user_id uuid,
  p_amount_cents integer
)
RETURNS integer AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.user_billing
  SET payg_balance_cents = payg_balance_cents - p_amount_cents,
      updated_at = now()
  WHERE user_id = p_user_id
    AND payg_balance_cents >= p_amount_cents
  RETURNING payg_balance_cents INTO new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient PAYG balance'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**调用方式**（Session 8 completion handler 使用）：
```typescript
const { data, error } = await supabase.rpc('decrement_payg_balance', {
  p_user_id: user.id,
  p_amount_cents: priceCents,
});
```

### 3. Free Tier 实验数量检查 RPC

```sql
-- Check if user can create a new experiment (Free tier = 1 lifetime limit)
CREATE OR REPLACE FUNCTION public.check_experiment_quota(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  user_plan text;
  experiment_count integer;
  payg_balance integer;
BEGIN
  SELECT plan, payg_balance_cents INTO user_plan, payg_balance
  FROM public.user_billing WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO experiment_count
  FROM public.experiments
  WHERE user_id = p_user_id AND archived_at IS NULL;

  -- Free tier: plan = 'payg' AND payg_balance = 0 AND no subscription
  -- Free tier gets 1 lifetime experiment
  IF user_plan = 'payg' AND payg_balance = 0 AND experiment_count >= 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'free_tier_limit',
      'experiment_count', experiment_count,
      'message', 'Free accounts include 1 experiment. Top up your PAYG balance or upgrade to Pro.'
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'experiment_count', experiment_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Free tier 定义**（product-design.md）：`plan = 'payg'` + `payg_balance_cents = 0` + 无 stripe_subscription_id。这不是一个独立的 plan 值 — 它是 PAYG 的零余额状态。Session 8 的 billing gate 在 authorize 时调用此 RPC。

Status transitions（作为 CHECK constraints）：
- experiments.status: draft, active, paused, verdict_ready, completed, archived
- skill_executions.status: pending, running, paused, completed, failed, timed_out
  （注：budget exceeded 不是独立 status — 使用 `paused` + `gate_type = 'budget_exceeded'`，与 approval gate pattern 一致）
- distribution_campaigns.status: draft, paused, active, completed, failed
- hypotheses.status: pending, testing, passed, failed, skipped, blocked
- experiment_alerts.alert_type 包含 bug_auto_fixed

## PR 3: Core CRUD API Routes

实现以下 routes（全部需要 auth，使用 withAuth + withErrorHandler）：

Experiments:
- GET    /api/experiments — list（paginated, grouped by status）
- GET    /api/experiments/:id — get single（含 latest round data）
- POST   /api/experiments — create（from claimed spec data）
- PATCH  /api/experiments/:id — update status/url/decision
- DELETE /api/experiments/:id — soft delete（设置 archived_at）

Sub-resources:
- POST/GET /api/experiments/:id/hypotheses — mode: append|replace
- POST/GET /api/experiments/:id/variants — variants CRUD
- POST/GET /api/experiments/:id/insights — scorecard + decision history
- POST/GET /api/experiments/:id/research — research results
- GET/POST /api/experiments/:id/rounds — rounds 管理

注意事项：
- 所有 GET 使用显式列列表（不用 SELECT *），防止信息泄露
- 所有 POST body 使用 zod 验证，string 字段加 .max() 约束
- Pagination: ?page=1&limit=20（max 100）
- Sub-resource POST 支持 mode=append（默认）和 mode=replace

每个 PR 完成后 npm run build 零错误。
```

---

### Session 4 — SSE Spec Streaming + Anonymous Specs + Claim Flow

**目标**：实现核心的 spec 生成流程 — AI 流式生成 spec、匿名暂存、登录后认领。

**输入**：Session 3 的数据层

**输出**：
- `POST /api/spec/stream` — SSE 流式 spec 生成
- `POST /api/spec/claim` — 认领匿名 spec（含 check_experiment_quota 调用）
- `src/lib/spec-stream-parser.ts` — `>>>EVENT:` 解析器
- 前端 `specReducer` — 累积 SSE events 为 UI state

**输出合约**（Session 5 验证）：
```
src/lib/spec-stream-parser.ts → export function parseSpecStreamLine(line: string): SpecStreamEvent | null
src/lib/spec-reducer.ts       → export function specReducer(state: SpecState, event: SpecStreamEvent): SpecState
                               → export type SpecState = { meta, cost, preflight[], hypotheses[], variants[], funnel[], status, ... }
                               → export type SpecStreamEvent = (union of 10 event types)
                               → export const initialSpecState: SpecState
src/app/api/spec/stream/route.ts → POST handler returning SSE Response
src/app/api/spec/claim/route.ts  → POST handler returning { experiment_id: string }
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 3（Flow 1: Idea → Spec）和 Section 5（>>>EVENT: Streaming Protocol）。
读 docs/ux-design.md Screen 2（The Assay）。

用 /change 实现 SSE spec streaming：

## 1. POST /api/spec/stream（无需 auth）

这是 Assayer 最核心的 endpoint — 匿名用户输入 idea，AI 实时流式生成完整 spec。
System prompt 的 AI reasoning rules 来自 `.claude/patterns/spec-reasoning.md`（shared with CLI /spec skill），外加 `>>>EVENT:` JSON output format 指令。

Request body:
```typescript
{
  idea: string,         // >= 20 chars
  level?: 1 | 2 | 3,   // default 1
  session_token: string, // browser-generated UUID
  regenerate_token?: string  // id of previous anonymous_spec to replace (skip rate limit)
}
```

实现：
a. Zod 验证 input（idea >= 20 chars, .max(10000)）
b. Rate limit: anonymous 3 per session_token per 24h（查 anonymous_specs 表 count）; authenticated free accounts 5 per user_id per 24h（查 anonymous_specs + experiments 表 count）
b2. Regenerate handling: 当 regenerate_token 存在时：
    - 验证该 anonymous_spec row 属于当前 session_token
    - 跳过 rate limit 检查
    - 删除旧的 anonymous_spec row
    - 后续步骤正常创建新 row（net effect: row 被替换，count 不增加）
c. 调用 Anthropic API（Opus 4.6），system prompt 指示输出 >>>EVENT: JSON markers
d. 流式解析 Claude 文本输出，提取 >>>EVENT: 行，解析 JSON
e. 转发为 SSE events（data: {json}\n\n）
f. 流结束后，将完整 spec 存入 anonymous_specs 表（session_token, spec_data, preflight_results, idea_text）
g. 24h TTL（expires_at = now + 24h）

SSE Event Types（来自 product-design.md）：
```typescript
type SpecStreamEvent =
  | { type: 'meta'; name: string; level: number; experiment_type: string }
  | { type: 'cost'; build_cost: number; ad_budget: number; estimated_days: number }
  | { type: 'preflight'; dimension: 'market' | 'problem' | 'competition' | 'icp';
      status: 'pass' | 'caution' | 'fail'; summary: string; confidence: string }
  | { type: 'preflight_opinion'; text: string }
  | { type: 'hypothesis'; id: string; category: string; statement: string;
      metric: { formula: string; threshold: number; operator: 'gt'|'gte'|'lt'|'lte' };
      priority_score: number; experiment_level: number; depends_on: string[] }
  | { type: 'variant'; slug: string; headline: string; subheadline: string;
      cta: string; pain_points: string[]; promise: string; proof: string;
      urgency: string | null }
  | { type: 'funnel'; available_from: Record<string, string> }
  | { type: 'complete'; spec: FullSpecData; anonymous_spec_id: string }
  | { type: 'input_too_vague' }
  | { type: 'error'; message: string };
```

System prompt 要求 Claude 以 inference mode 运行 — 绝不问 follow-up questions，aggressive inference，标记 [inferred] 值。

## 2. >>>EVENT: 解析器

创建 `src/lib/spec-stream-parser.ts`：
- 逐行扫描 Claude 的文本输出
- 匹配 `>>>EVENT:` 前缀
- JSON.parse 提取结构化事件
- Skip 解析失败的行（continue）
- 将 complete event 的 spec 暂存

## 3. 前端 specReducer

创建 `src/lib/spec-reducer.ts`：
```typescript
export function specReducer(state: SpecState, event: SpecStreamEvent): SpecState {
  switch (event.type) {
    case 'meta':              return { ...state, meta: event };
    case 'cost':              return { ...state, cost: event };
    case 'preflight':         return { ...state, preflight: [...state.preflight, event] };
    case 'preflight_opinion': return { ...state, preflightOpinion: event.text };
    case 'hypothesis':        return { ...state, hypotheses: [...state.hypotheses, event] };
    case 'variant':           return { ...state, variants: [...state.variants, event] };
    case 'funnel':            return { ...state, funnel: [...state.funnel, event] };
    case 'complete':          return { ...state, status: 'complete', fullSpec: event.spec, anonymousSpecId: event.anonymous_spec_id };
    case 'input_too_vague':   return { ...state, status: 'too_vague' };
    case 'error':             return { ...state, status: 'error', error: event.message };
    default:                  return state;
  }
}
```

## 4. POST /api/spec/claim（需要 auth）

登录后认领匿名 spec：
a. 接收 { session_token }
b. 查 anonymous_specs by session_token
c. 从 spec_data 创建 experiment + hypotheses + variants
d. 删除 anonymous_specs row
e. 返回 { experiment_id }

## 5. Error Handling

参照 product-design.md Spec Stream Error Handling：
- Claude API timeout → SSE error event
- 格式错误 → skip，继续处理
- Rate limit → 429 response
- Network disconnect → 支持重试（same session_token 不消耗 quota）
- Supabase write failure → 降级处理，spec 保留在 frontend memory

每个文件 npm run build 零错误。
```

---

### [CP1] Checkpoint: Foundation + Data Layer

**验证范围**：Sessions 1-4 的所有输出。

**检查项**：
1. `npm run build` 零错误
2. `npx tsc --noEmit` 零错误
3. `npm test` 通过（所有 src/**/*.test.ts + tests/flows.test.ts）
4. 17 张表的 migration 存在且语法正确
5. RLS policies 覆盖所有表
6. Core CRUD routes 可 curl 测试（需 Supabase local dev running）：
   - `POST /api/spec/stream` 返回 SSE events
   - `GET /api/experiments` 返回 200（with auth header）
   - `POST /api/spec/claim` 返回 experiment_id（with auth + session_token）
7. `docs/CONVENTIONS.md` 存在且包含 12 sections
8. `experiment/experiment.yaml` 和 `experiment/EVENTS.yaml` 格式正确

**输出**：CP1 verification report（markdown）。失败项必须修复后才能进入 Phase 3。

---

## Phase 3: UI Core

### Session 5 — Landing Page + Assay Page + Signup Gate

**目标**：实现前三个核心页面 — 用户从输入 idea 到看到完整 spec 到注册。

**输入**：Session 4 的 SSE streaming + specReducer + claim flow

**输出**：
- Landing page（Screen 1: one input field）
- Assay page（Screen 2: spec materializing in final form）
- Signup Gate（Screen 3: save your experiment）
- Pre-flight caution UI

**输入合约验证**（Session 开始时执行）：
```bash
# 验证 Session 4 输出合约
grep -q "export function specReducer" src/lib/spec-reducer.ts || echo "FAIL: specReducer missing"
grep -q "export type SpecState" src/lib/spec-reducer.ts || echo "FAIL: SpecState type missing"
grep -q "export type SpecStreamEvent" src/lib/spec-reducer.ts || echo "FAIL: SpecStreamEvent type missing"
grep -q "export const initialSpecState" src/lib/spec-reducer.ts || echo "FAIL: initialSpecState missing"
test -f src/app/api/spec/stream/route.ts || echo "FAIL: spec stream route missing"
test -f src/app/api/spec/claim/route.ts || echo "FAIL: spec claim route missing"
```

**输出合约**（Session 6a 验证）：
```
src/app/page.tsx                      → Landing page with idea input + "Test it" CTA
src/app/assay/page.tsx                → Assay page with SSE streaming + specReducer + edit mode
src/components/signup-gate.tsx        → Modal overlay component with Google/GitHub/email auth
src/components/preflight-caution.tsx  → Pre-flight warning with [Proceed anyway] + [Adjust idea]
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md Screen 1（Landing）、Screen 2（The Assay）、Screen 3（Signup Gate）。

用 /change 实现三个核心页面：

## 1. Landing Page（/）— Screen 1

"One sentence for one answer" — 整个 above-the-fold 只有一个输入框。

结构（来自 ux-design.md）：
- 标题: "Know if it's gold before you dig."
- 副标题: Describe your idea → AI designs the experiment → code deploys → traffic flows from 6 channels → you get a verdict in days, not months.
- 大输入框: "Describe your business idea..."（textarea）
- CTA: "Test it →"
- 示例: [AI resume builder] [Meal prep planner]
- 底部: "312 ideas tested . 67 confirmed worth building"
  Data source: Landing page server component queries `SELECT count(*) FROM experiments WHERE status IN ('active','completed','verdict_ready')` for "ideas tested" 和 `SELECT count(*) FROM experiment_decisions WHERE decision = 'scale'` for "confirmed worth building"。Cache 1 hour（Next.js `revalidate: 3600`）。初始启动时 hardcode `312` / `67` 直到真实数据超过 50 行。使用 Supabase service role key（server component，不暴露给 client）。
- Advanced options 折叠: type selector (web-app/service/cli) + level selector (L1/L2/L3)，默认 web-app + L1
- **不显示定价 above the fold**（ux-design.md 明确要求：landing page sells the experience, not the plan）

Below-the-fold sections（滚动可见）：
- **Pain Points section**: 3 条用户痛点引用（vertical stack），例如 "I spent 6 months building something nobody wanted"
- **How It Works section**: 3-step vertical timeline: Describe your idea → AI designs the experiment → Get a verdict in days
- **Stats grid**（2×2）: Ideas tested / Money saved / Avg time to verdict / Accuracy — 数据来源同 hero 底部统计（server component query, revalidate: 3600）
- **Pricing section**: Plan cards（Free / PAYG / Pro / Team），滚动到底部可见但不在 above-the-fold 推广

点击 "Test it" → 导航到 /assay，传递 idea text。
传递机制: URL search params `?idea=encodeURIComponent(text)&type=web-app&level=1`。
不要使用 sessionStorage 或 React state — URL params 保证刷新后不丢失、支持分享链接。
Assay page mount 时从 `searchParams` 读取 idea 并自动触发 SSE stream。

## 2. Assay Page（/assay）— Screen 2

这是 Assayer 的核心 UX — spec 在最终布局中逐步 materialize。

此页面有两种模式：
- **Creation mode**（无 query params，匿名可用）：调用 /api/spec/stream → 生成新 spec
- **Edit mode**（?experiment=<id>&round=N&mode=edit，需要 auth）：加载已有实验数据，
  bottleneck highlighted + AI 建议的修改预填。由 REFINE verdict return flow 触发。
  检测 URL query params 以决定模式。

a. 调用 POST /api/spec/stream（SSE）
b. 使用 specReducer 累积 events
c. 页面布局 = 最终的 Review & Edit 布局，但初始为空/skeleton

Progressive rendering 顺序（来自 product-design.md Data Flow Timeline）：
- t=1s: meta → header renders（name, level, type）
- t=2s: cost → cost badge 出现
- t=3-8s: preflight → 4 个 dimension checks 逐个动画（✓/!/✗）
- t=9s: preflight_opinion → AI opinion 文本 fade in
- t=10-18s: hypothesis → cards 逐个 fade in
- t=19-25s: variant → cards 填充
- t=26-28s: funnel → threshold rows
- t=29s: complete → "Create & Launch" 按钮激活

c. Generation 完成后：
- 所有字段显示 edit icon [e]（但 disabled，需要 auth）
- "Create & Launch" 按钮出现
- "Regenerate" 按钮出现（调用 /api/spec/stream，传递 regenerate_token = 上次 complete event 返回的 anonymous_spec_id，不消耗新的 rate limit quota）
- "WHAT HAPPENS NEXT" section

d. Pre-flight caution（ux-design.md）：
- 如果任何 preflight dimension 是 caution 或 fail
- 显示 AI Opinion section
- [Adjust idea & re-check] → 返回 landing（带 competition context）
- [Proceed anyway →] → 继续

e. 点击 edit 或 "Create & Launch" → 触发 Signup Gate（if unauthenticated）

## 3. Signup Gate — Screen 3

Modal overlay（不是新页面），触发条件：未登录用户点击 edit 或 "Create & Launch"。

内容：
- "Pre-flight passed. Your experiment spec is ready."
- "Sign up to save this experiment and start testing."
- "Your free account includes 1 complete experiment."
- [Continue with Google]
- [Continue with GitHub]
- Email + password form
- "Already have an account? [Sign in]"

使用 Supabase Auth：
- Google OAuth（openid email profile）
- GitHub OAuth
- Email + password

TOTP 2FA 流程（product-design.md Section 2 要求）：
- Email+password 注册完成后，显示 TOTP 2FA enrollment 步骤
- 使用 Supabase Auth MFA API：supabase.auth.mfa.enroll({ factorType: 'totp' })
- 显示 QR code + manual secret entry
- 用户输入 6 位验证码确认 enrollment
- 后续每次 email+password 登录需要 TOTP 验证：supabase.auth.mfa.challengeAndVerify()
- OAuth 登录（Google/GitHub）跳过 TOTP（这些 provider 有自己的 2FA 机制）
- 2FA enrollment UI 作为 Signup Gate modal 的 inline step，保持用户在 spec 上下文中

登录成功后：
a. 调用 POST /api/spec/claim { session_token }
   - claim 内部先调用 `check_experiment_quota` RPC 检查 Free tier 限制
   - 如果 quota 不足，返回 403 + `{ error: { code: 'free_tier_limit', message: '...' } }`
   - 前端显示: "Free accounts include 1 experiment. [Top up $10 →] or [Upgrade to Pro →]"
b. 返回同一页面，edit icons 激活，"Create & Launch" 可用

session_token：browser-generated UUID，存在 cookie 中。用于关联匿名 spec。

## 4. Assay Edit Mode（?experiment=<id>&round=N&mode=edit）

REFINE verdict return flow 触发此模式（Session 7 实现 return flow，本 session 构建 edit mode UI）。

检测: 页面 mount 时检查 URL query params。如果 mode=edit 存在：

a. Auth check: 必须已登录（edit mode 不允许匿名），否则重定向到 /lab

b. 数据加载: GET /api/experiments/:id — 返回 experiment + hypotheses + variants + latest round metrics + previous round verdict
   （使用 Session 3 实现的 experiments/:id API，含 latest round data）

c. Header: 显示 "Round {N} (editing)" indicator + experiment name
   与 creation mode 的 "Assaying: ..." header 区分

d. Bottleneck highlighting:
   - 从 previous round verdict 获取 bottleneck dimension
   - Bottleneck hypothesis card 显示 amber border + "bottleneck" badge
   - 其他 hypothesis cards 正常显示

e. AI Suggestion panel:
   - 每个 bottleneck hypothesis card 下方: collapsed Accordion "AI Suggestion"（shadcn/ui Accordion）
   - 内容从 experiment_decisions.reasoning 提取
   - 完全可编辑

f. 表单预填: 所有字段（hypotheses, variants, funnel thresholds）从已有数据预填

g. 操作:
   - [Create & Launch] → 创建新 round（experiment_rounds row），触发 Build & Launch
   - [Regenerate] → 不可用（edit mode 不支持重新生成整个 spec）
   - Edit icons 直接可用（已登录）

npm run build 零错误。
```

---

### Session 6a — Build & Launch Flow

**目标**：实现 Launch page 的完整 7-phase 流程。

**输入**：Session 5 的 Landing/Assay/Signup

**输出**：
- Launch page（Screen 5: Build → Quality Gate → Deploy → Content Check → Walkthrough → Distribution Approval → Live）
- Mock realtime events（真实 Cloud Run Jobs 在 S9 实现）

**输出合约**（Session 6b 验证）：
```
src/app/launch/[id]/page.tsx → Launch page with 7-phase UI (Build → Quality Gate → Deploy → Content Check → Walkthrough → Distribution Approval → Live)
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md Screen 5（Build & Launch）。
读 docs/assayer-product-design.md Section 3（Flow 3: Build → Deploy → Distribute）。
读 docs/CONVENTIONS.md。

用 /change 实现 Launch page：

## 1. Launch Page（/launch/[id]）— Screen 5

点击 "Create & Launch" 后进入此页面。流程 level-dependent：

L1: Build → Deploy → Content Check → Distribution Approval → Live
L2: Build → Quality Gate → Deploy → Walkthrough → Distribution Approval → Live
L3: Build → Quality Gate → Deploy → Walkthrough → Distribution Approval → Live

### Phase A: Build & Deploy

- 上方: variant carousel preview（live preview 原则）
- 下方: progress bar + step list
- 步骤: "Experiment saved" → "Landing page scaffolded (3 variants)" → "Deploying..."
- [View build logs] 折叠区域
- 使用 Supabase Realtime 订阅 exec:{execution_id} channel
- Event types: log, status, gate, progress（含 preview_url）

注意：Session 9 实现真正的 Cloud Run Jobs 触发。本 session 构建完整 UI，
使用 mock/stub 数据模拟 realtime events，确保 UI 流程完整。

### Phase B (L2/L3): Quality Gate

- 显示 behavior tests 状态: ok / testing / queued / failed
- Auto-fix loop UI: "AI is diagnosing..." → "Fixing..." → "Re-testing..."
- 失败后三个选项: [Simplify feature] [Skip feature] [Describe fix]

### Phase C (L1): Content Check

部署完成后显示 live preview + editable text:
- Headline [e], Subheadline [e], CTA [e], Pain points [e], Promise/Proof [e]
- 点击 [e] → inline text editor
- 编辑更新 variants 表（零 rebuild）
- 编辑过的字段显示 "(edited)" badge（inline, text-xs text-muted-foreground）
- Variant cross-contamination prevention（适用于 Content Check 和 Walkthrough）:
  保存任一 variant 的编辑后，显示 toast:
  "You edited {variant_name}. Review the other {N} variants too?"
  含 [Review] button → carousel 自动滚动到下一个 variant（防止 A/B contamination）
- "Looks good? [Continue to Distribution →]" / "[Review & edit content]"

### Phase D (L2/L3): Walkthrough

Golden path 步骤列表:
- 每步: description + [Open →]（新标签打开 live experiment）
- User 确认或报告问题
- 问题: text input + [Fix this →]（触发 micro /change）
- Variant cross-contamination prevention: 同 Content Check — 编辑任一 variant 后 toast 提醒 review 其他 variants + auto-scroll
- [Skip walkthrough — looks good]

### Phase E: Channel Setup (first-time only)

如果用户没有连接任何 distribution channel:
- RECOMMENDED (free): Twitter/X, Reddit, Email (Resend)
- PAID (Pro required): Google Ads, Meta Ads, Twitter Ads
- [Skip — I'll drive traffic myself]

### Phase F: Distribution Approval Gate

- AI 生成的分发计划: per-channel budget + creative preview
- [Preview Creative v] 展开显示 ad copy / tweet thread / reddit post
- "Google/Meta bill you directly — Assayer never touches your ad budget."
- [Edit Plan] [Launch Distribution →]

### Phase G: Distribution Live

- Channel 状态列表: ok/pending/failed
- "What happens now" section
- [Go to experiment →]

npm run build 零错误。
```

---

### Session 6b — Experiment Page + Change Request + Alerts

**目标**：实现实验主页面和 change request UI。

**输入**：Session 6a 的 Launch page

**输出**：
- Experiment page（Screen 6: Scorecard hero + traffic + live assessment + detail tabs）
- Change Request UI（natural-language change interface）
- Alert banners（7 alert types）
- Action button state changes

**输出合约**（Session 7 验证）：
```
src/app/experiment/[id]/page.tsx → Experiment page with scorecard hero + traffic + live assessment + detail tabs
src/components/change-request.*  → Change Request UI component
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md Screen 6（Experiment Page）。
读 docs/assayer-product-design.md Section 8（Alert System）。
读 docs/CONVENTIONS.md。

用 /change 实现：

## 1. Experiment Page（/experiment/[id]）— Screen 6

用户每天回来看的主页面。

Content Check 编辑: 所有 level（L1/L2/L3）的 experiment page 上，variant text fields 都显示 [e] edit icons，支持 free inline editing（零 rebuild，直接更新 variants 表）。编辑过的字段显示 "(edited)" badge。这与 Launch page 的 Content Check phase 共享相同的 inline editor 组件。

结构（严格按照 ux-design.md 的 ASCII wireframe）：

Header: 名称 + status badge + Day X/Y + Level

=== FUNNEL SCORECARD ===（hero）
- 5 维度（REACH, DEMAND, ACTIVATE, MONETIZE, RETAIN）
- 每个: progress bar + ratio + PASS/LOW/N/A
- 包含 actual vs threshold 和 sample size
- Confidence bands: <30 insufficient, 30-100 directional, 100-500 reliable, 500+ high

=== TRAFFIC ===
- Total clicks / spend / avg CPC
- Per-channel mini bar chart（clicks, spend, CTR）
- Budget progress bar
- [Pause All] [Adjust v]

=== LIVE ASSESSMENT ===
- Bottleneck identification
- Best channel
- Projected verdict
- [Analyze Now] [Upgrade to L2] [Request Change]

[Analyze Now] guard clause UI: 当 guard 触发（total clicks < 100 或 experiment duration < 50% of estimated_days）时，不跳转到 verdict page。而是显示 inline dialog/toast，包含 directional signal（"Early signal: REACH looks strong, DEMAND needs more data"）+ sample size indicator + "Need ~X more clicks for a reliable verdict"。仅当 guard 通过时才跳转到 /verdict/[id]。

--- Details ---（折叠区域）
- [Hypotheses] [Variants] [Distribution] [Raw Data] [History]

Hypotheses tab 显示 per-hypothesis status（CONFIRMED / REJECTED / INCONCLUSIVE / BLOCKED / TESTING），来自 /iterate 结果写入 hypotheses 表的 status 字段。每个 hypothesis card 显示 status badge + 关联的 metric ratio。BLOCKED hypotheses 显示依赖关系链接。

## 2. Alert Banners

Alert banners（顶部，来自 experiment_alerts 表）：
- 7 种 alert type（product-design.md Section 8）
- 每种: one-line description + action buttons
- bug_auto_fixed: green-tinted banner（informational）

## 3. Change Request

[Request Change] 打开 natural-language change interface：

Before distribution（no traffic）:
- Text input: "What do you want to change?"
- AI analysis: impact list + classification + price
- [Apply Change $6] [Cancel]

During active experiment（traffic flowing）:
- Warning: "This experiment has been live for X days (Y clicks)."
- "Changing X will start a NEW ROUND because..."
- [Start Round 2 with this change →] [Cancel]

## 4. Action Button State Changes

Action buttons 根据 status 变化（来自 ux-design.md）：
- Active: [Pause] [Analyze Now] [Upgrade] [Request Change]
- Completed: [View Verdict] [Archive]
- Draft: [Deploy]

npm run build 零错误。
```

---

### [CP2] Checkpoint: UI Core

**验证范围**：Sessions 5-6b 的所有输出。

**检查项**：
1. `npm run build` 零错误
2. `npx tsc --noEmit` 零错误
3. Landing page（/）渲染无错误
4. Assay page（/assay）SSE streaming 可用
5. Launch page（/launch/[id]）7-phase UI 完整（mock events）
6. Experiment page（/experiment/[id]）scorecard + traffic + assessment + details tabs 渲染
7. Signup Gate modal 触发正常
8. Alert banners 渲染（mock data）
9. Change Request UI 打开/关闭正常
10. 所有页面无 console errors

**输出**：CP2 verification report。失败项必须修复后才能进入 Phase 4。

---

## Phase 4: Supporting Pages + Billing

### Session 7 — Lab + Verdict + Compare + Settings

**目标**：实现剩余四个页面。

**输入**：Session 6 的 Experiment Page

**输出**：
- Lab page（Screen 8: portfolio view）
- Verdict page（Screen 7: full-screen ceremony）
- Compare page（multi-experiment comparison）
- Settings page（Screen 9）
- REFINE / PIVOT return flows

**输出合约**（Session 8 验证）：
```
src/app/lab/page.tsx            → Lab page with portfolio view (grouped by state)
src/app/verdict/[id]/page.tsx   → Verdict page with 4 verdict types (SCALE/KILL/REFINE/PIVOT)
src/app/compare/page.tsx        → Compare page with side-by-side comparison
src/app/settings/page.tsx       → Settings page with 4 sections (Account, Connected Accounts, Distribution Channels, Plan & Billing)
src/app/api/experiments/compare/route.ts → GET handler
src/app/api/experiments/[id]/metrics/export/route.ts → GET handler (CSV download)
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md Screen 7（Verdict）、Screen 7a（Return Flows）、Screen 8（Lab）、Screen 9（Settings）、Experiment Comparison。

用 /change 实现四个页面：

## 1. Lab Page（/lab）— Screen 8 "Your Lab"

Portfolio view — experiments grouped by state:
- RUNNING: card 显示 bottleneck ratio + Day X/Y + ON TRACK/LOW + channel count + spend
- VERDICT READY: prominent visual cue + [View Verdict →]
- COMPLETED: compact cards with verdict badge

Empty state（ux-design.md 明确要求）:
- "No experiments yet."
- "Every founder has ideas. The difference is knowing which one to build."
- [Test your first idea →]

Card 信息密度（Robinhood approach）: 每张 card ONE number — bottleneck ratio。

[+ New Idea] button → 导航到 Landing page。

## 2. Verdict Page（/verdict/[id]）— Screen 7

**这是 Assayer 最重要的页面 — full-screen moment。**

四种 verdict，每种不同的 emotional treatment：

### SCALE
- "↑ SCALE" — 大字
- "AI Invoice Tool passed all tested funnel dimensions."
- 5 维度 ratio + badge
- DISTRIBUTION ROI: spend, clicks, per-channel performance
- "Recommendation for L2: ..."
- [Upgrade to L2 →] [View Full Report]

### KILL
- "✕ KILL"
- "Meal Prep Planner failed top-funnel validation."
- **"You saved approximately 3 months of building. This is a good outcome."**
  （ux-design.md: "This single sentence is the concentrated UX philosophy"）
- [Archive & Start New Experiment →] [View Post-Mortem]

### REFINE
- "~ REFINE"
- "AI Invoice Tool has signal but one dimension needs work."
- Bottleneck dimension highlighted
- [Apply Changes & Re-test →] [Upgrade to L2 →] [View Full Report]

### PIVOT
- "<-> PIVOT"
- "SaaS Analytics Dashboard has weak signal across the board."
- "Consider: Change target audience / Reframe value prop / Test different channels"
- [Start New Experiment with Pivot →] [View Post-Mortem] [Archive]

### Status Transition: verdict_ready → completed

Verdict page mount 时（或用户执行任何 verdict action 后），更新 experiment status:
- PATCH /api/experiments/:id { status: 'completed' }
- 这标记用户已查看并确认 verdict（product-design.md: "verdict_ready → completed: user views and acknowledges verdict"）
- REFINE 和 PIVOT 的后续 action 会进一步触发其他 transition（draft 或 archived）

### Post-Mortem（KILL 和 PIVOT verdicts only）

[View Post-Mortem] 不是独立路由 — 实现为 `/verdict/[id]` 页面的 tab（`?tab=postmortem`）。内容：

- **Final Scorecard**: 实验结束时所有 dimension ratios 的快照
- **Per-Channel ROI Table**: 每个 distribution channel 的 spend, clicks, conversions, CPA
- **AI Analysis**: 一段 AI 生成的失败原因分析（verdict 生成时写入 `experiment_decisions.reasoning`，此处直接展示）
- **Round Timeline**: 如果存在多轮（REFINE），显示 Round 1 → Round 2 → ... 的 key metric 变化
- **Data Export**: [Download CSV] 按钮导出 experiment_metric_snapshots 原始数据

Post-Mortem 的设计目的：把"失败"转化为"学习"。KILL verdict 说 "you saved 3 months"，Post-Mortem 说 "here's exactly what you learned"。

## 3. Return Flows（Screen 7a）

### REFINE Return:
[Apply Changes & Re-test →] 触发：
a. 创建 experiment_rounds row（round_number = N+1）
b. 更新 experiment status → draft
c. 重定向到 /assay?experiment={experiment_id}&round=N+1&mode=edit
   （使用 query params — /assay 同时服务匿名创建和认证编辑模式）
d. 页面显示: Round indicator + bottleneck highlighted + AI fix pre-filled

### PIVOT Return:
[Start New Experiment with Pivot →] 触发：
a. 当前 experiment → archived, decision = pivot
b. 创建 new experiment with parent_experiment_id
c. 重定向到 /（Landing），idea 预填 AI-suggested pivot direction

Lab lineage visualization:
- REFINE rounds: Lab card 右上角显示 "Round N" badge。点击 badge 展开 dropdown 列出所有 rounds（verdict + key metric）。每个 round 链接到其 verdict page。数据来自 `experiment_rounds` 表。
- PIVOT lineage: Lab card 名称下方显示 "Pivoted from {parent_name}" subtitle。使用 `experiments.parent_experiment_id` 外键。点击 parent name 导航到 parent experiment 的 verdict page。
- 视觉分组: REFINE rounds 在 Lab 中通过缩进或共享 header 视觉关联。PIVOT children 作为独立 card 显示，带 lineage subtitle。

## 4. Compare Page（/compare）

Side-by-side experiment comparison（2+ experiments）:
- 表格: experiment name × dimension ratios
- Verdict, Confidence, Cost, Time, Best channel
- "* Recommended: X has strongest signal"
- Pro/Team plan only

API: GET /api/experiments/compare?ids=uuid1,uuid2,uuid3

## 5. Settings Page（/settings）— Screen 9

四个 section:

ACCOUNT:
- Email, [Change Password]

CONNECTED ACCOUNTS（login OAuth）:
- Google, GitHub — [Disconnect]

DISTRIBUTION CHANNELS（distribution OAuth — 独立于 login OAuth!）:
Organic: Twitter/X, Reddit, Resend
Paid: Google Ads, Meta Ads, Twitter Ads
每个: status + [Connect →] / [Disconnect]

PLAN & BILLING:
- Current plan + pool usage
- PAYG balance
- Plan comparison（inline，不是单独页面）
- [Manage Subscription] → Stripe Customer Portal
- [View Invoices]

Comparison table（来自 ux-design.md）：
| Free | PAYG | Pro $99/mo | Team $299/mo |
（完整的 plan feature matrix）

## 6. API Routes

实现 Settings、Compare 和 Post-Mortem 需要的 routes:
- GET /api/experiments/compare?ids=...
- GET /api/experiments/:id/metrics/export — 导出 experiment_metric_snapshots 为 CSV
  （Post-Mortem tab 的 [Download CSV] 按钮使用此 endpoint）
  实现: SELECT 该 experiment 的所有 metric snapshots, 转换为 CSV format, 返回 Content-Type: text/csv + Content-Disposition: attachment
- 其他 settings-related routes 在 Session 8（Billing）实现

## 6b. PIVOT Return Flow 的 idea 预填

PIVOT return flow 重定向到 `/?idea=encodeURIComponent(pivotSuggestion)&pivot_from=experimentId`。
Landing page 检测 `pivot_from` query param 并在 idea input 下方显示:
"Pivoted from: {parent experiment name}. AI suggestion: {pivot direction}"
（数据来自 PIVOT verdict 时写入的 `experiment_decisions.next_steps` 字段）

npm run build 零错误。
```

---

### Session 8 — Billing + Operations

**目标**：实现完整的 billing 系统 — Stripe integration、operation classifier、billing gate、PAYG + subscription。

**输入**：Session 7 的页面 + Session 3 的 user_billing / operation_ledger 表

**输出**：
- Stripe integration（subscriptions + PAYG checkout + portal）
- Operation classifier（Haiku）
- Billing gate（authorize before execution）
- Completion handler
- Webhook handler（5 event types）
- Billing API routes

**输出合约**（Session 9a 验证）：
```
src/lib/operation-classifier.ts                → export function classifyOperation
src/app/api/operations/authorize/route.ts      → POST handler returning { operation_id, price, type, billing_source }
src/app/api/operations/complete/route.ts       → POST handler
src/app/api/billing/subscribe/route.ts         → POST handler
src/app/api/billing/topup/route.ts             → POST handler
src/app/api/billing/portal/route.ts            → POST handler
src/app/api/billing/usage/route.ts             → GET handler
src/app/api/webhooks/stripe/route.ts           → POST handler with signature verification
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 2（Billing & Metering Architecture）。
读 docs/ux-design.md Pricing & Plans section。

用 /change 实现完整 billing 系统：

## 1. Operation Classifier

创建 `src/lib/operation-classifier.ts`:
- Model: Haiku 4.5（~$0.001/call）
- Input: skill name + user description + affected behaviors
- Output: { type: "change" | "small_fix", confidence, reasoning }
- confidence < 0.7 → default to "change"（protects margin）
- 不需要 classify: creates（level known）, spec gen（always free）

## 2. Billing Gate

POST /api/operations/authorize:
a. 接收: { experiment_id, skill_name, description? }
b. Classify operation（if applicable）
c. 确定价格（product-design.md PAYG pricing table）:
   - Spec generation: Free
   - Create L1: $10, L2: $15, L3: $25
   - Change: $6, Small fix: $2
   - Content edit: Free, Auto-fix: Free
d. 检查 billing source（关键代码锚点）:
   ```typescript
   // Billing source resolution order
   const billing = await supabase.from('user_billing').select('plan, payg_balance_cents, creates_used, modifications_used, pool_resets_at, stripe_subscription_id').eq('user_id', user.id).single();

   // Free tier = payg plan + zero balance + no subscription
   const isFree = billing.plan === 'payg' && billing.payg_balance_cents === 0 && !billing.stripe_subscription_id;

   if (isFree) {
     // Free tier: only spec_gen (unlimited) and 1 lifetime create allowed
     if (operationType === 'spec_gen') return { billing_source: 'free', price_cents: 0 };
     const quota = await supabase.rpc('check_experiment_quota', { p_user_id: user.id });
     if (!quota.allowed) return NextResponse.json({ error: { code: 'free_tier_limit', message: quota.message } }, { status: 403 });
     return { billing_source: 'free', price_cents: 0 }; // first experiment is free
   }

   // Subscriber: check pool
   if (billing.plan === 'pro' || billing.plan === 'team') {
     const poolLimits = { pro: { creates: 3, mods: 15 }, team: { creates: 10, mods: 60 } };
     const limits = poolLimits[billing.plan];
     if (isCreate && billing.creates_used < limits.creates) return { billing_source: 'pool', price_cents: 0 };
     if (isMod && billing.modifications_used < limits.mods) return { billing_source: 'pool', price_cents: 0 };
     // Overage: fall through to PAYG (Team gets 10% discount per ux-design.md pricing table)
   }

   // PAYG: check balance (Team overage at 90% of PAYG rates)
   const overagePriceCents = billing.plan === 'team' ? Math.round(priceCents * 0.9) : priceCents;
   if (billing.payg_balance_cents >= overagePriceCents) return { billing_source: 'payg', price_cents: overagePriceCents };

   // Insufficient balance
   return NextResponse.json({ error: { code: 'insufficient_balance', message: `Top up at least $${(priceCents / 100).toFixed(2)}` } }, { status: 402 });
   ```
e. 创建 operation_ledger row（status: authorized, token_budget）
f. Token budgets: Create L1 6M, L2 10M, L3 16M, Change 5M, Small fix 1.5M
g. 返回: { operation_id, price, type, billing_source }

## 3. Completion Handler

POST /api/operations/complete:
a. 接收: { operation_id, actual_tokens_used, status }
b. 更新 operation_ledger（actual cost, status）
c. Subscriber: decrement pool counter（creates_used or modifications_used）
   ```typescript
   // Atomic pool decrement
   await supabase.from('user_billing')
     .update({ [isCreate ? 'creates_used' : 'modifications_used']: billing[isCreate ? 'creates_used' : 'modifications_used'] + 1 })
     .eq('user_id', user.id);
   ```
d. PAYG: 使用 Session 3 创建的 `decrement_payg_balance` RPC（原子递减，防止竞态）:
   ```typescript
   const { data, error } = await supabase.rpc('decrement_payg_balance', {
     p_user_id: user.id,
     p_amount_cents: priceCents,
   });
   if (error) { /* handle insufficient balance — should not happen if authorize was called first */ }
   ```
e. PostHog server event: skill_cost { billed, actual_cost, margin_pct }

## 4. Stripe Integration

### Subscriptions
POST /api/billing/subscribe:
- 创建 Stripe Checkout session（subscription mode）
- Products: Pro（$99/mo, STRIPE_PRO_PRICE_ID）, Team（$299/mo, STRIPE_TEAM_PRICE_ID）

### PAYG Top-up
POST /api/billing/topup:
- Stripe Checkout session（one-time payment）
- Amount: $10-$500

### Customer Portal
POST /api/billing/portal:
- Stripe Customer Portal session URL
- 用于 subscription management, invoices, payment method

### Usage
GET /api/billing/usage:
- Current period summary: creates_used, modifications_used, payg_balance, pool_resets_at

## 5. Stripe Webhooks

POST /api/webhooks/stripe:
签名验证（STRIPE_WEBHOOK_SECRET）
处理 5 种 event types:

a. checkout.session.completed:
   - 判断是 subscription 还是 topup（metadata 区分）
   - Subscription: 更新 user_billing plan + stripe IDs
   - Topup: 增加 payg_balance_cents

b. customer.subscription.created:
   - 初始化 pool counters（Pro: 3 creates + 15 mods; Team: 10 + 60）

c. customer.subscription.updated:
   - 如果 current_period_start 变化 → reset pool counters
   - 处理 plan upgrade/downgrade

d. customer.subscription.deleted:
   - plan → 'payg', subscription_status → 'canceled'

e. invoice.payment_failed:
   - subscription_status → 'past_due'

## 6. Pricing UX Integration

在 experiment page 和 change request UI 中集成 pricing 显示：
- Pre-modification: classification + price + remaining quota
- Experiment page footer（subscriber only）: "Modifications: 11/15 used this month"
- Near quota exhaustion: warning + upgrade CTA
- Free operations: no cost indicator

修改 Session 6 创建的文件（增量修改）：
a. src/app/experiment/[id]/page.tsx — footer 添加 pool usage bar（GET /api/billing/usage）
b. Change Request 组件 — 添加 classification + price + quota display（POST /api/operations/authorize preview）
c. Near quota exhaustion 时显示 warning banner + [Upgrade to Pro] CTA

## 7. Hosting Fee

每个 active experiment 收取 $5/mo hosting fee（Vercel/Railway 运行成本）:
- Free plan: 30 天免费，之后 auto-pause（experiment status → paused, distribution stopped）
- PAYG: 从 payg_balance_cents 中按月扣除
- Pro: 3 个 active experiments 包含在 $99/mo 中，超出部分 $5/mo each
- Team: 10 个 active experiments 包含在 $299/mo 中，超出部分 $5/mo each
- **实现方式**: 创建 Vercel Cron `/api/cron/hosting-billing`（monthly, 1st of month 00:00 UTC）:
  1. Query all users with active experiments (status IN ('active', 'verdict_ready'))
  2. For each user, count active experiments
  3. Determine included hosting slots: Free=1 (30 days only), PAYG=0, Pro=3, Team=10
  4. For Free tier: if experiment.started_at + 30 days < now() → auto-pause (status='paused', distribution stopped) + notification
  5. For overage experiments (count > included): charge $5/mo per overage experiment
     - PAYG: `supabase.rpc('decrement_payg_balance', { p_user_id, p_amount_cents: overageCount * 500 })`
     - Team: charge at 90% rate ($4.50/mo per overage experiment)
     - If insufficient balance: send email warning, auto-pause after 7 days
  6. PostHog server event: hosting_billing { user_id, active_count, included, overage_count, charged_cents }
- Auto-pause 前 7 天发送 email warning（复用 notification trigger 5 的 budget_alert 模板）
- 将此 cron 添加到 vercel.json 的 crons 配置中

## 8. PAYG→Pro Conversion Ladder

追踪用户累计月 PAYG 花费，当 spend > $90/mo 时 surface upgrade prompt:
- 在 experiment page footer 和 billing usage page 显示:
  "You spent $92 this month on PAYG. Pro is $99/mo with 3 creates + 15 modifications included."
- PostHog server event: payg_upgrade_prompt_shown { monthly_spend_cents, plan: 'payg' }
- 计算逻辑: SUM(operation_ledger.price_cents) WHERE created_at >= current_period_start AND user_id = X AND status = 'completed'

Environment variables 需要:
- STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRO_PRICE_ID, STRIPE_TEAM_PRICE_ID

npm run build 零错误。
```

---

### [CP3] Checkpoint: Full UI + Billing

**验证范围**：Sessions 5-8 的所有输出。

**检查项**：
1. `npm run build` 零错误
2. `npx tsc --noEmit` 零错误
3. `npx vitest run` 通过
4. 所有 8 个页面渲染无错误（landing, assay, launch, experiment, verdict, lab, compare, settings）
5. Billing API routes 返回正确 HTTP status：
   - `POST /api/operations/authorize` → 200 with { operation_id, price }
   - `POST /api/billing/subscribe` → redirect to Stripe Checkout
   - `GET /api/billing/usage` → 200 with usage data
6. Stripe webhook handler signature 验证正常（test mode）
7. Settings 页面 4 sections 完整
8. Verdict page 4 种 verdict 类型渲染正确
9. Lab page 空状态 + 有数据状态渲染
10. Compare page Pro/Team gate 生效

**输出**：CP3 verification report。失败项必须修复后才能进入 Phase 5。

---

## Phase 5: Infrastructure

### Session 9a — Skill Execution API + Realtime (Vercel)

**目标**：实现 Vercel 侧的 skill execution API routes、Realtime 集成、approval gate pattern。

**输入**：Session 8 的 billing gate（skill execution 需要先 authorize）

**输出**：
- Skill execution API routes（execute, status, approve, cancel）
- `/api/operations/:id/extend` route
- Supabase Realtime streaming integration（browser 订阅）
- Approval gate pattern（Web UI 侧）

**输出合约**（Session 9b 验证）：
```
src/app/api/skills/execute/route.ts              → POST handler returning { execution_id }
src/app/api/skills/[id]/route.ts                 → GET handler
src/app/api/skills/[id]/approve/route.ts         → POST handler
src/app/api/skills/[id]/cancel/route.ts          → POST handler
src/app/api/operations/[id]/extend/route.ts      → POST handler
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 2（Skill Execution Model, Cloud Run Jobs, Agent SDK, Approval Gate Pattern）。
读 docs/CONVENTIONS.md。

注意：Agent SDK API shape（query, resumeSession, session.events）是 product-design.md 的示意代码。
实现前验证 @anthropic-ai/claude-agent-sdk 最新 API。如 API 不同，按实际实现，保持相同功能语义
（invoke skill → stream events → approval gate → resume）。

用 /change 实现 Vercel 侧 skill execution：

## 1. Skill Execution API Routes

POST /api/skills/execute:
a. Auth required
b. Billing gate: 调用 /api/operations/authorize（除非 free operation）
c. 创建 skill_executions row（status: pending）
d. 触发 Cloud Run Job:
   - POST to Cloud Run Jobs API: /apis/run.googleapis.com/v2/.../jobs:run
   - Execution-specific env vars via overrides.containerOverrides[].env:
     EXPERIMENT_ID, SKILL_NAME, USER_ID, EXECUTION_ID,
     SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
     RAILWAY_TOKEN（用于 Railway hosting 的实验部署）
e. 返回 { execution_id }

GET /api/skills/:id:
- Execution status + events

POST /api/skills/:id/approve:
- 更新 skill_executions status = 'running'（from 'paused'）
- Job 在 polling loop 中检测到变化，恢复执行

POST /api/skills/:id/cancel:
- 更新 status = 'failed'

## 2. Supabase Realtime Integration

Browser 订阅 Supabase Realtime channel `exec:{execution_id}`:

Channel authorization: `exec:{execution_id}` channels 需要验证 subscriber ownership。

**实现方案**：使用 Supabase Realtime **Broadcast** 模式（不是 Postgres Changes）。Broadcast channels 不经过 RLS — 它们是 ephemeral pub/sub。安全性通过以下方式保证：

1. **Channel name 不可猜测**: `exec:{execution_id}` 其中 execution_id 是 UUID — 知道 channel name 等价于拥有访问权
2. **执行 ID 只返回给 authenticated owner**: POST /api/skills/execute 在创建 skill_execution 后返回 execution_id，只有发起请求的 authenticated user 能拿到
3. **Frontend 在订阅前验证 auth**: Browser 端使用 authenticated Supabase client 订阅，确保只有登录用户能建立 Realtime 连接
4. **Server-side 使用 service role key 发布**: skill-runner.js 使用 SUPABASE_SERVICE_KEY 发布到 channel，不受 RLS 限制

```typescript
// Browser (authenticated user)
const supabase = createBrowserClient();
const channel = supabase.channel(`exec:${executionId}`);
channel.on('broadcast', { event: 'log' }, (payload) => { /* update UI */ });
channel.on('broadcast', { event: 'progress' }, (payload) => { /* update progress */ });
channel.on('broadcast', { event: 'gate' }, (payload) => { /* show approval UI */ });
channel.subscribe();

// skill-runner.js (service role)
const channel = supabase.channel(`exec:${executionId}`);
await channel.send({ type: 'broadcast', event: 'progress', payload: { pct: 50, phase: 'deploying' } });
```

Event types（来自 product-design.md）:
- log: { line: string, ts: number } — 输出流
- status: { status: "running" | "paused" | "completed" | "failed" } — 状态变更
- gate: { gate_type: string, prompt: string } — 触发 approval UI
- progress: { pct: number, phase: string, preview_url?: string } — 进度 + preview

前端 Launch page 已在 Session 6a 构建了 UI，本 session 连接真实的 Realtime events。

## 3. Approval Gate Pattern

实现 product-design.md 描述的 approval gate：
1. Job hits gate → writes status='paused' + gate_type to skill_executions
2. Job polls Supabase every 5s for status change
3. User approves via Web UI → POST /api/skills/:id/approve
4. Job detects change → resumes
5. 30min timeout → status='timed_out'

## 4. Token Budget Extension Route

POST /api/operations/:id/extend:
a. Auth required
b. 验证 original operation 属于当前用户且 skill_executions.status = 'paused' AND gate_type = 'budget_exceeded'
c. 计算 continuation 费用（same billing flow as /api/operations/authorize）
d. 创建新 operation_ledger row（parent_operation_id 指向原始 row）
e. 更新 skill_executions status → 'running'
f. 返回 { new_operation_id, charged_cents }

Environment variables 需要:
- GCP_PROJECT_ID, GCP_REGION
- CLOUD_RUN_JOB_NAME
- GCP_SA_KEY（Service Account for Vercel → Cloud Run invocation）

npm run build 零错误。
```

---

### Session 9b — Docker + skill-runner.js (Cloud Run)

**目标**：实现 Cloud Run Jobs 侧 — Docker image、skill-runner.js、workspace lifecycle、per-experiment hosting。

**输入**：Session 9a 的 Vercel 侧 API routes

**输出**：
- Docker image spec（`docker/Dockerfile`）
- `docker/skill-runner.js` entrypoint
- Token budget enforcement
- Per-experiment hosting setup（Vercel + Railway routing）
- Workspace lifecycle（8 steps）

**输出合约**（Session 10 验证）：
```
docker/Dockerfile       → exists with FROM node:20-slim base
docker/skill-runner.js  → exists, passes node --check
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 2（Cloud Run Jobs, Agent SDK, Workspace Lifecycle）。
读 docs/CONVENTIONS.md。

用 /change 实现 Cloud Run Jobs 侧：

## 1. Docker Image（Dockerfile）

创建 `docker/Dockerfile`（spec for Cloud Run Jobs container）:

| Layer | Contents |
|-------|----------|
| Base | node:20-slim |
| System deps | git, curl, jq |
| CLIs | vercel, @railway/cli, supabase, claude-code (Agent SDK) |
| Template | Pre-loaded mvp-template .claude/ directory |
| Entrypoint | skill-runner.js |

## 2. Skill Runner

创建 `docker/skill-runner.js`:
a. 读取 env vars（EXPERIMENT_ID, SKILL_NAME, etc.）
b. Clone experiment repo（existing）或 copy mvp-template（new）
c. Generate experiment.yaml from Supabase data
c2. Generate `.claude/spec-manifest.json` from Supabase experiment data（hypotheses, variants, metrics, round history）。/iterate skill 读取此 manifest 作为输入。
d. Inject env vars
e. 初始化 Supabase Realtime channel
f. Agent SDK runs skill
g. Stream events to Realtime channel
h. Approval gate handling（poll for resume）
i. Parse output → write to Supabase tables
j. Git push results

## 3. Token Budget Enforcement

k. Token budget enforcement:
   - 从 `operation_ledger` row 读取 `token_budget`（Session 8 创建的字段）
   - 通过 `ai_usage` rows（linked to this operation）追踪累积 input tokens
   - 每次 AI API call 前: check cumulative tokens vs budget
   - 80% budget: log warning to Realtime channel（`{ type: 'log', line: '⚠ Token budget 80% reached' }`）
   - 100% budget: gracefully stop skill，写 partial results to Supabase，发送 `{ type: 'gate', gate_type: 'budget_exceeded', used: N, budget: M, continue_cost_cents: X }` event on Realtime channel（复用 approval gate 事件模型，skill status 设为 `paused`）
   - Browser 显示 "Continue for $X?" modal（复用 approval gate UI pattern）
   - User approve → POST /api/operations/:id/extend → skill resume

## 4. Per-Experiment Hosting Setup

skill-runner.js 处理每个实验的 hosting 配置（/deploy skill 执行时）。根据 experiment.yaml `stack.hosting` 值路由：

### Vercel path（hosting: vercel — 默认）
- Vercel API 创建新 project（name = experiment slug）
- 配置 domain: {experiment-slug}.assayer.io
- 前提：assayer.io 域名配置 wildcard DNS（*.assayer.io → Vercel）
- 注入 experiment-specific env vars
- 部署: `vercel --prod`

### Railway path（hosting: railway — AI agent / long-running experiments）
- Railway CLI 创建新 project: `railway init` + `railway link`
- 配置 custom domain: `railway custom-domain add {experiment-slug}.assayer.io`
- 前提：assayer.io 域名 DNS 同时支持 Vercel（A record）和 Railway（CNAME per experiment）
- 注入 experiment-specific env vars: `railway variables set KEY=VALUE`（循环）
- 部署: `railway up --detach`
- Health check: `curl {experiment-slug}.assayer.io/api/health`
- 完整的 Railway Deploy Interface 参见 `.claude/stacks/hosting/railway.md`

### 路由逻辑（skill-runner.js 中实现）
```javascript
const hosting = experimentYaml.stack?.services?.[0]?.hosting || 'vercel';
if (hosting === 'railway') {
  await deployToRailway(experimentSlug, envVars);
} else {
  await deployToVercel(experimentSlug, envVars);
}
```

DNS 配置：
- Vercel experiments: wildcard DNS `*.assayer.io → Vercel`（A record 76.76.21.21）
- Railway experiments: per-experiment CNAME（`{slug}.assayer.io → {project}.up.railway.app`）
- 方案：Vercel wildcard 作为默认，Railway experiments 在部署时通过 Cloudflare API 添加 CNAME override

Cloudflare DNS API 集成（skill-runner.js 中实现）：
```javascript
// Only for Railway experiments — Vercel uses wildcard
async function addCloudflareCNAME(slug, railwayDomain) {
  const resp = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/dns_records`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'CNAME', name: `${slug}.assayer.io`, content: railwayDomain, proxied: true }),
  });
  if (!resp.ok) throw new Error(`Cloudflare DNS failed: ${await resp.text()}`);
}
```

Environment variables（添加到 S14 deploy checklist）:
- CLOUDFLARE_API_TOKEN（Zone:DNS:Edit permission）
- CLOUDFLARE_ZONE_ID（assayer.io zone ID）

## 5. Workspace Lifecycle

实现 product-design.md 的 8 步 lifecycle:
1. Container starts from Docker image
2. Clone or copy template
3. Generate experiment.yaml from Supabase
4. Inject env vars
5. Agent SDK runs skill
6. Git push results
7. Parse output → Supabase
8. Container destroyed

npm run build 零错误。
```

---

### Session 10 — Distribution System (6 Adapters)

**目标**：实现分发系统 — 6 个 adapter、channel setup、campaign management。

**输入**：Session 9 的 skill execution infrastructure

**输出**：
- Distribution adapter interface
- 6 adapters（twitter-organic, reddit-organic, email-resend, google-ads, meta-ads, twitter-ads）
- Distribution API routes
- Channel setup flow（OAuth）
- Campaign management（pause/resume/adjust）

**输出合约**（Session 11 验证）：
```
src/lib/distribution/types.ts                         → export interface DistributionAdapter { publish, measure, manage }
src/lib/distribution/adapters/twitter-organic.ts       → implements DistributionAdapter
src/lib/distribution/adapters/reddit-organic.ts        → implements DistributionAdapter
src/lib/distribution/adapters/email-resend.ts          → implements DistributionAdapter
src/lib/distribution/adapters/google-ads.ts            → implements DistributionAdapter
src/lib/distribution/adapters/meta-ads.ts              → implements DistributionAdapter
src/lib/distribution/adapters/twitter-ads.ts           → implements DistributionAdapter
src/app/api/experiments/[id]/distribution/route.ts     → GET handler
src/app/api/experiments/[id]/distribution/sync/route.ts    → POST handler
src/app/api/experiments/[id]/distribution/manage/route.ts  → POST handler
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 2（Distribution Adapter Architecture）。

用 /change 实现分发系统：

## 1. Adapter Interface

创建 `src/lib/distribution/types.ts`:
```typescript
interface DistributionAdapter {
  publish(config: AdsYaml, credentials: OAuthTokens): Promise<{ campaign_id: string; campaign_url: string }>;
  measure(campaign_id: string, credentials: OAuthTokens): Promise<DistributionMetrics>;
  manage(campaign_id: string, action: 'pause' | 'resume' | 'update', credentials: OAuthTokens): Promise<void>;
}

interface DistributionMetrics {
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  ctr: number;
  cpc_cents: number;
}
```

## 1b. 前置步骤：确认 meta-ads.md stack file

Session 0 已在 mvp-template 中创建 `.claude/stacks/distribution/meta-ads.md`。
验证该文件存在且包含 Meta Marketing API v21.0 的完整 spec（Ad Format, Targeting, API Procedure 等）。
如果 Session 0 尚未执行，需先在 mvp-template repo 中执行 Session 0。

## 2. Six Adapters

创建 `src/lib/distribution/adapters/`:

| Adapter | Tier | API |
|---------|------|-----|
| twitter-organic.ts | Free | X API v2 |
| reddit-organic.ts | Free | Reddit API |
| email-resend.ts | Free | Resend API |
| google-ads.ts | Paid | Google Ads API |
| meta-ads.ts | Paid | Meta Marketing API |
| twitter-ads.ts | Paid | X Ads API |

每个 adapter 实现 DistributionAdapter interface。

MCC / Partner billing model（paid ads）:
- Google Ads: MCC creates child customer account → user links payment method
- Meta Ads: Business Manager creates ad account
- Twitter Ads: user's own ads account → OAuth

Paid adapters 需要 Pro/Team plan（检查 user_billing.plan）。

## 3. Distribution API Routes

GET  /api/experiments/:id/distribution — list campaigns
POST /api/experiments/:id/distribution/sync — force metrics sync from ad platforms
POST /api/experiments/:id/distribution/manage — pause/resume/adjust:
  { campaign_id, action: 'pause' | 'resume' | 'update' }

## 4. Channel Setup（OAuth flows）

Settings 页面已在 Session 7 有 UI stub。
本 session 实现实际 OAuth 连接:

Organic:
- Twitter/X: OAuth 2.0 PKCE
- Reddit: OAuth 2.0
- Resend: API key（非 OAuth）

Paid:
- Google Ads: OAuth 2.0 + MCC sub-account creation
- Meta Ads: Facebook Login → Business Manager
- Twitter Ads: OAuth 1.0a

Token 存储: oauth_tokens 表（encrypted via Supabase Vault）。

**OAuth callback routes**（distribution channels 的 OAuth 回调，独立于 Supabase Auth 的 login OAuth）:

| Route | Provider | Flow |
|-------|----------|------|
| GET /api/distribution/callback/twitter | Twitter/X | OAuth 2.0 PKCE → exchange code → store tokens |
| GET /api/distribution/callback/reddit | Reddit | OAuth 2.0 → exchange code → store tokens |
| GET /api/distribution/callback/google-ads | Google Ads | OAuth 2.0 → exchange code + create MCC sub-account → store tokens |
| GET /api/distribution/callback/meta | Meta/Facebook | OAuth 2.0 → exchange code + get ad account → store tokens |
| GET /api/distribution/callback/twitter-ads | Twitter Ads | OAuth 1.0a → exchange request token → store tokens |

每个 callback route:
a. 验证 state parameter（防 CSRF）
b. Exchange authorization code for access + refresh tokens
c. Upsert oauth_tokens row（encrypted via Supabase Vault）
d. Redirect back to `/settings?channel=connected&provider={name}`

将这些 routes 添加到输出合约中。

## 5. Plan-Gated Channels

distribution campaign 创建时检查用户 plan:
- Free/PAYG: only organic channels
- Pro/Team: all channels
- UI 中 paid channels 显示 "Pro plan required" badge

Environment variables:
- TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
- REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
- RESEND_API_KEY
- GOOGLE_ADS_MCC_ID, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN
- META_APP_ID, META_APP_SECRET
- TWITTER_ADS_CONSUMER_KEY, TWITTER_ADS_CONSUMER_SECRET

npm run build 零错误。
```

---

### [CP4] Checkpoint: Infrastructure

**验证范围**：Sessions 9a-10 的所有输出。

**检查项**：
1. `npm run build` 零错误
2. `npx tsc --noEmit` 零错误
3. `npx vitest run` 通过
4. Skill execution API routes 返回正确 HTTP status：
   - `POST /api/skills/execute` → 200 with { execution_id }（需 auth + billing gate）
   - `GET /api/skills/:id` → 200 with execution status
   - `POST /api/skills/:id/approve` → 200
5. `docker/Dockerfile` 存在且语法正确（`docker build --check` or similar）
6. `docker/skill-runner.js` 存在且 `node --check docker/skill-runner.js` 通过
7. Distribution adapter interface types 正确
8. 6 adapters 实现 DistributionAdapter interface
9. OAuth flow routes 存在
10. Realtime channel 订阅模式正确

**输出**：CP4 verification report。失败项必须修复后才能进入 Phase 5。

---

## Phase 6: Automation

### Session 11 — Metrics Cron + Alerts + Verdict Engine + Notifications

**目标**：实现自动化后台 — 15 分钟 metrics sync、alert 检测、verdict engine、notification dispatch。

**输入**：Session 10 的 distribution + Session 6 的 experiment page（scorecard + alerts）

**输出**：
- Metrics sync cron（15 min）
- Alert detection + experiment_alerts
- Verdict engine（decision framework）
- Notification dispatch（7 triggers）
- Email templates（Resend）
- Anonymous spec cleanup cron（1h）

**输出合约**（Session 12a 验证）：
```
src/app/api/cron/metrics-sync/route.ts     → GET handler with CRON_SECRET verification
src/app/api/cron/cleanup/route.ts          → GET handler
src/app/api/cron/notifications/route.ts    → GET handler
src/app/api/cron/cost-monitor/route.ts     → GET handler
src/app/api/experiments/[id]/alerts/route.ts → GET handler
src/app/api/notifications/route.ts          → GET handler
src/lib/email.ts                            → email template functions
vercel.json                                 → contains "crons" configuration
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/assayer-product-design.md Section 3（Flow 4: Metrics Sync）、Section 7（Notification System）、Section 8（Alert System）。
读 docs/ux-design.md Notifications & Re-engagement section 和 Error & Edge States section。

用 /change 实现自动化系统：

## 1. Metrics Sync Cron（每 15 分钟）

创建 Vercel Cron `/api/cron/metrics-sync`:

a. Query all experiments WHERE status IN ('active', 'verdict_ready')
b. For each experiment, 分两步收集 metrics:

   **Step 1: Paid channel metrics（API 直接获取）**
   - 对 distribution_campaigns WHERE status = 'active' AND channel IN ('google-ads', 'meta-ads', 'twitter-ads')
   - 调用对应 adapter.measure() → impressions, clicks, spend, CTR, CPC
   - 更新 distribution_campaigns 行

   **Step 2: All channel metrics via PostHog（UTM 追踪）**
   - PostHog Events API 查询该 experiment 的 landing page 事件（按 utm_source 分组）
   - **Organic channels（twitter-organic, reddit-organic, email-resend）没有平台 API metrics。**
     它们的 clicks 只能通过 PostHog 的 UTM params 间接追踪:
     `utm_source=twitter&utm_medium=organic`, `utm_source=reddit&utm_medium=organic`, `utm_source=email&utm_medium=campaign`
   - PostHog API 也提供 behavior metrics（signups via `signup_complete` event, CTA clicks via `cta_click` event）

   **Merge 策略**: Paid channels 使用 ad platform API 的 impressions/spend 数据 + PostHog 的 conversion 数据。
   Organic channels 仅使用 PostHog UTM-filtered 数据（clicks = page views with matching utm_source）。

c. 写入 experiment_metric_snapshots（time-series），channel_metrics jsonb 包含 per-channel breakdown
d. 计算 scorecard ratios:
   - REACH  = actual_CTR / threshold_CTR → ratio（paid channels 用 ad platform CTR；organic 用 PostHog clicks / total reach 估算）
   - DEMAND = actual_signup_rate / threshold → ratio（PostHog signup_complete event / total visitors）
   - ACTIVATE = actual_activation_rate / threshold → ratio（PostHog activate event / total signups, L2+ only）
   - MONETIZE = actual_pricing_clicks / threshold → ratio（PostHog cta_click on pricing / total visitors）
   - RETAIN = actual_return_rate / threshold → ratio（PostHog returning visitors / total visitors, L3 only）
e. Confidence bands: <30 insufficient, 30-100 directional, 100-500 reliable, 500+ high

Force sync route: POST /api/experiments/:id/metrics/sync?force_verdict=true
- 不带 force_verdict: 仅 sync metrics（default）
- 带 force_verdict=true: sync + 运行 verdict engine（"Analyze Now" 按钮使用）
- **Analyze Now 的 guard clause 由后端判断**（不依赖前端）:
  后端检查 total_clicks < 100 OR experiment duration < 50% estimated_days
  如果 guard 触发: 返回 `{ verdict: null, guard: { clicks: 52, needed: 100, days_pct: 29, directional_signal: {...} } }`
  前端收到 guard 响应后显示 inline dialog（Session 6b 的 "Not Enough Data Yet" UI）
  如果 guard 通过: 返回 `{ verdict: 'scale'|'refine'|'pivot'|'kill', ... }`，前端重定向到 /verdict/[id]

GET /api/experiments/:id/metrics — cached scorecard（最新 metric_snapshot row）

## 2. Alert Detection

在 metrics sync 中检测 alert conditions:

| Condition | Alert Type |
|-----------|-----------|
| spend / budget > 0.9 | budget_exhausted |
| dimension ratio declining > 10% | dimension_dropping |
| last_sync > 26h | metrics_stale |
| ad account suspended | ad_account_suspended |
| DEMAND ratio = 0.0x with 50+ clicks | runtime bug（auto-fix trigger）|
| ACTIVATE ratio = 0.0x with 20+ signups | runtime bug（auto-fix trigger）|
| MONETIZE ratio = 0.0x with 30+ signups | runtime bug（auto-fix trigger）|
| Any page returning 5xx errors in PostHog data | runtime bug（auto-fix trigger）|

创建 experiment_alerts rows（severity: info/warning/critical）。

post_removed alert（Reddit/Twitter organic）:
- 检测: distribution adapter measure() 返回 404 或 post_status=removed
- Alert action button: [Repost to different subreddit] → 触发 distribution adapter publish() with 新 subreddit config（用户选择或 AI 推荐替代 subreddit）
- Alert type: post_removed, severity: warning

Alert API:
- GET  /api/experiments/:id/alerts — list unresolved
- PATCH /api/experiments/:id/alerts/:alertId — resolve/dismiss

Runtime auto-fix detection（L2/L3）:
- 0.0x ratio with sufficient traffic → trigger /verify against live experiment
- 如果发现 bug → 自动触发 /change + redeploy
- 创建 bug_auto_fixed alert + notification
- Auto-fix 操作对用户始终免费

## 2b. /iterate Skill Integration

Metrics sync cron 调用 /iterate skill 逻辑（而非仅 inline decision framework）:
- 读取 spec-manifest.json（由 skill-runner.js 在 Session 9 生成）
- 运行 per-hypothesis verdict: 每个 hypothesis 独立判定 CONFIRMED / REJECTED / INCONCLUSIVE
- 写入 hypotheses 表 status 字段（passed = CONFIRMED, failed = REJECTED, testing = INCONCLUSIVE）
- 生成 iterate-manifest.json: { experiment_id, round, verdict, bottleneck, recommendations, variant_winner, analyzed_at, hypothesis_verdicts, funnel_scores }
- Experiment-level verdict 由 per-hypothesis verdicts 聚合得出（all CONFIRMED → SCALE, any top-funnel REJECTED → KILL, etc.）

## 3. Verdict Engine

在 metrics sync 中检测 verdict conditions:

Decision framework（来自 product-design.md）:
| Condition | Decision |
|-----------|----------|
| All tested dimensions >= 1.0 | SCALE |
| Any top-funnel (REACH or DEMAND) < 0.5 | KILL |
| 2+ dimensions < 0.8 | PIVOT |
| 1+ dimensions < 1.0 but fewer than 2 below 0.8 | REFINE |

Guard clause (no verdict issued): Total clicks < 100 OR experiment duration < 50% of estimated_days. When guard triggers on "Analyze Now": show inline directional signal, not a verdict page.

Two-tier verdict:
- Tier 1: guard clause — if insufficient data (<100 clicks or <50% experiment duration), return null (no verdict yet)
- Tier 2: per-dimension ratio analysis: SCALE / KILL / PIVOT / REFINE based on failure pattern

Dependency-aware: if parent hypothesis REJECTED → dependent hypotheses BLOCKED。

Verdict 产生后:
a. Write experiment_decisions row，包含:
   - decision, all dimension ratios + confidence + sample_size
   - bottleneck_dimension, bottleneck_recommendation
   - reasoning (AI-generated analysis text)
   - next_steps (recommendations for REFINE/PIVOT)
   - **distribution_roi** (jsonb): 聚合 distribution_campaigns 数据，包含:
     ```json
     {
       "total_spend_cents": 20000,
       "total_clicks": 502,
       "avg_cpc_cents": 40,
       "per_channel": [
         { "channel": "google-ads", "spend_cents": 5200, "clicks": 312, "ctr": 3.8, "cpc_cents": 17 },
         { "channel": "twitter-organic", "spend_cents": 0, "clicks": 112, "ctr": null, "cpc_cents": 0 },
         ...
       ],
       "best_channel": "google-ads",
       "worst_channel": "meta-ads",
       "recommendations": ["Double Google Ads budget", "Cut Meta Ads"]
     }
     ```
     数据来源: SELECT FROM distribution_campaigns WHERE experiment_id = :id AND round_number = current_round
   - **variant_winner** (text): 需要在 experiment_decisions 表新增 `variant_winner text` 列（通过 migration: `ALTER TABLE experiment_decisions ADD COLUMN variant_winner text;`）。从 PostHog variant A/B 数据中确定表现最佳的 variant slug，写入此列。如果 confidence 不足则为 null。
b. Update experiment status → verdict_ready
c. Trigger verdict_ready notification

Also handle "Analyze Now" button: POST /api/experiments/:id/metrics/sync with force_verdict=true。

## 4. Notification Dispatch

7 种 notification triggers（product-design.md Section 7）:

| # | Trigger | Timing |
|---|---------|--------|
| 1 | experiment_live | Immediate after deploy |
| 2 | first_traffic | ~24h（检测: total_clicks 首次 > 10）|
| 3 | mid_experiment | ~Day 3（检测: estimated_days * 0.4）|
| 4 | verdict_ready | When verdict produced |
| 5 | budget_alert | When spend/budget > 0.9 |
| 6 | dimension_dropping | When decline detected |
| 7 | bug_auto_fixed | After auto-fix completes |

实现:
- 创建 notifications row
- 使用 Resend API 发送 email
- Email 模板包含 mini scorecard（ux-design.md 明确要求: "enough info to decide without opening app"）
- 使用 inline HTML 构建邮件模板（参照 .claude/stacks/email/resend.md 模式）
- 每种 trigger 一个模板函数（src/lib/email.ts），包含 experiment name + scorecard bars + CTA button
- Daily cron 检测 triggers 2, 3, 5, 6

### /api/cron/notifications route handler

创建 `src/app/api/cron/notifications/route.ts`:
a. 验证 CRON_SECRET（Vercel Cron 安全机制）
b. Query experiments WHERE status = 'active'
c. 对每个 experiment 检测 4 种 daily triggers:
   - Trigger 2 (first_traffic): total_clicks 首次 > 10 且未发送过此 notification
   - Trigger 3 (mid_experiment): 当前天数 >= estimated_days * 0.4 且未发送过
   - Trigger 5 (budget_alert): spend/budget > 0.9 且未发送过
   - Trigger 6 (dimension_dropping): 任一 dimension ratio 较前次下降 > 10% 且未发送过
d. 对每个触发的 notification: 创建 notifications row + 使用对应模板函数生成 email HTML + Resend API 发送
e. 返回 { processed: number, notifications_sent: number }

注意: Triggers 1 (experiment_live) 和 4 (verdict_ready) 是即时触发（在部署完成和 verdict engine 中直接发送），不经过 cron。
Trigger 7 (bug_auto_fixed) 是即时触发（在 auto-fix 完成时直接发送），不经过 daily cron。将 bug_auto_fixed 加入 daily cron 的检测列表作为 fallback（检测: auto-fix 完成但 notification 未发送的情况）。

## 4b. Internal Cost Monitoring Cron（weekly）

创建 Vercel Cron `/api/cron/cost-monitor`（weekly, Sunday 00:00 UTC）:
- 计算 blended margin: (total_charged - total_actual_cost) / total_charged across all operations this week
- 检查 hard limit hit rate: count(operations WHERE actual_tokens_used > token_budget) / total_operations
- 检查 auto-fix rate: count(bug_auto_fixed alerts) / total_active_experiments
- **Cloud Run budget monitoring**（product-design.md §10 约束）:
  - Query Cloud Run billing API (或 GCP Budget API) 获取当月 Cloud Run compute 花费
  - $50/mo alert: 当月花费 >= $50 → PostHog event `cloud_run_budget_alert` + 发送内部 alert email
  - $100/mo hard limit: 当月花费 >= $100 → 设置 feature flag 暂停新 Cloud Run Job 调度，PostHog event `cloud_run_budget_hard_limit` + 紧急 alert email
  - 在 `/api/operations/authorize` billing gate 中增加 Cloud Run hard limit 检查：如果 hard limit 已触发，拒绝需要 Cloud Run 的操作（返回 503 + 用户友好提示）
- PostHog server events: platform_margin_weekly { blended_margin_pct, hard_limit_hit_rate, auto_fix_rate, total_revenue_cents, total_cost_cents, cloud_run_spend_cents }
- 用于内部 PostHog monitoring dashboard（不面向用户）

## 5. Anonymous Spec Cleanup Cron（每 1 小时）

Vercel Cron `/api/cron/cleanup`:
- DELETE FROM anonymous_specs WHERE expires_at < now()

## 5b. Notification CRUD Routes

GET /api/notifications:
- Auth required，paginated（newest first），包含 unread_count
- Filter: ?unread=true

PATCH /api/notifications/:id:
- Auth required，更新状态: { read: true } 或 { dismissed: true }
- 验证通知属于当前用户

POST /api/notifications/mark-all-read:
- Auth required，批量标记所有未读为已读

注意：这些 notification CRUD routes 仅用于后端 dispatch + email delivery 追踪。
MVP 不构建 in-app notification center UI（per ux-design.md: "No in-app notification center"）。
前端不消费这些 API。所有 notification 通过 email (Resend) 触达用户。

## 6. Vercel Cron Configuration

vercel.json crons:
- /api/cron/metrics-sync: every 15 minutes（scorecard + alerts + verdict engine）
- /api/cron/cleanup: every hour（anonymous_specs TTL）
- /api/cron/notifications: daily at 9am UTC（检测 triggers 2, 3, 5, 6 — first_traffic, mid_experiment, budget_alert, dimension_dropping）
- /api/cron/cost-monitor: weekly, Sunday 00:00 UTC（internal margin + hit rate + auto-fix rate monitoring）
- /api/cron/hosting-billing: monthly, 1st of month 00:00 UTC（hosting fee billing for active experiments, Session 8 §7）

注意: Vercel Cron 需要 CRON_SECRET 环境变量验证。

npm run build 零错误。
```

---

## Phase 7: Polish

### Session 12a — CSS Tokens + 6 Mobile Components

**目标**：建立 CSS foundation 和 6 个 mobile components。

**输入**：Session 5-7 的所有页面

**输出**：
- CSS timing tokens + safe area variables + mobile utilities
- 6 个新 mobile components
- Breakpoint strategy + particles + swipe-to-archive

**输出合约**（Session 12b 验证）：
```
src/components/mobile-tab-bar.tsx         → exists (Bottom nav: Lab / New / Settings)
src/components/mobile-bottom-sheet.tsx    → exists (Draggable bottom sheet)
src/components/scrollable-tab-strip.tsx   → exists (Horizontal scrollable pills)
src/components/card-carousel.tsx          → exists (Snap-scroll cards)
src/components/pull-to-refresh.tsx        → exists (Custom pull-to-refresh)
src/components/sticky-action-bar.tsx      → exists (Bottom CTA + safe-area)
src/app/globals.css                       → contains --dur-instant, --ease-out-expo, --safe-top CSS variables
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md 的 Responsive & Mobile Design section（完整读完）。
读 docs/CONVENTIONS.md。

用 /change 实现 CSS foundation 和 mobile components：

## 1. CSS Foundation

在 globals.css 添加:

### Timing tokens（:root）
- Duration: --dur-instant(50ms), --dur-micro(100ms), --dur-fast(150ms), --dur-normal(250ms),
  --dur-emphasis(400ms), --dur-dramatic(600ms), --dur-ceremony(900ms), --dur-ambient(3000ms), --dur-float(4000ms)
- Easing: --ease-out-expo, --ease-out-back, --ease-in-out-sine, --ease-out-quart, --ease-in-expo, --ease-spring
  （具体 cubic-bezier / linear() 值来自 ux-design.md）
- Stagger: --stagger-item(60ms), --stagger-max(8), --stagger-cap(480ms)

### Safe area variables
- --safe-top, --safe-bottom, --safe-left, --safe-right
- --tab-bar-height: 56px
- --mobile-bottom-offset: calc(var(--tab-bar-height) + var(--safe-bottom))

### Mobile utilities
- .pb-safe, .pt-safe, .mb-tab
- .scrollbar-hide
- .touch-feedback:active（@media (pointer: coarse)）
- @media (prefers-reduced-motion: reduce) block

### Viewport
- meta viewport: width=device-width, initial-scale=1, viewport-fit=cover
- 使用 100dvh，不用 100vh
- overscroll-behavior-y: contain on body

## 2. Six New Mobile Components

| Component | File | Purpose |
|-----------|------|---------|
| MobileTabBar | src/components/mobile-tab-bar.tsx | Bottom nav: Lab / New / Settings |
| MobileBottomSheet | src/components/mobile-bottom-sheet.tsx | Draggable bottom sheet |
| ScrollableTabStrip | src/components/scrollable-tab-strip.tsx | Horizontal scrollable pills |
| CardCarousel | src/components/card-carousel.tsx | Snap-scroll cards + dot indicators |
| PullToRefresh | src/components/pull-to-refresh.tsx | Custom pull-to-refresh |
| StickyActionBar | src/components/sticky-action-bar.tsx | Bottom CTA + safe-area |

MobileTabBar specs:
- Height: 56px + env(safe-area-inset-bottom)
- bg-background/90 backdrop-blur-xl border-t
- 3 tabs: Lab (🧪), New (✨), Settings (⚙️)
- Active: primary color icon + label; inactive: muted icon only
- Hidden when keyboard open（visualViewport API）
- z-index: 50

## 3. Breakpoint Strategy

| Token | Width | Changes |
|-------|-------|---------|
| < sm | < 640px | Single column, full-width CTAs, bottom tab bar |
| sm | ≥ 640px | Inline CTAs, labels visible |
| md | ≥ 768px | Multi-column, top nav, particles ON |
| lg | ≥ 1024px | Full desktop density |
| xl | ≥ 1280px | max-w-7xl centered |

Particles OFF below md. Hover OFF below md（use :active instead）。
Touch targets min 44×44px。

Particles 实现:
- Desktop (md+): Landing page 环境粒子使用 CSS-only `@keyframes float` on `::before`/`::after` pseudo-elements（不用 `<canvas>` — ux-design.md 指定 "CSS gradient mesh"）。SCALE verdict 庆祝使用 `canvas-confetti` npm 包（3KB gzip）。所有粒子元素 `aria-hidden="true"` + `pointer-events: none`。
- Mobile (<md): 无粒子。Verdict celebration 使用 color gradient background transition 替代。

Swipe-to-archive 实现:
- Lab experiment cards 使用 touch event handlers（`touchstart`/`touchmove`/`touchend`）+ `transform: translateX()` 实现 swipe-left-to-archive。卡片滑动后露出红色 "Archive" action strip。Threshold: 卡片宽度 30% 触发 archive。不创建独立 SwipeableCard 组件 — inline 在 Lab card component 中实现。Container 使用 `overflow: hidden`。

npm run build 零错误。
```

---

### Session 12b — Animation Choreography + Per-Page Mobile

**目标**：实现 animation choreography 和 per-page mobile wireframes。

**输入**：Session 12a 的 CSS foundation + mobile components

**输出**：
- Per-page mobile wireframe implementation
- Animation choreography sequences（A, B, C）
- Per-verdict modulation

**输出合约**（Session 12c 验证）：
```
Animation Sequence A (Spec Materializing): verify via grep for "skeleton" + "crossfade" + "stagger" in assay/page.tsx
Animation Sequence B (Verdict Reveal): verify via grep for "verdict" + "spring" + "confetti" in verdict/[id]/page.tsx
Per-page mobile wireframes: all 8 pages have responsive breakpoints (grep for "sm:" or "md:" in each page.tsx)
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md 的 Animation Timing System section（完整读完）。
读 docs/CONVENTIONS.md。

用 /change 实现 animation choreography + per-page mobile：

## 1. Per-Page Mobile Wireframes

实现 ux-design.md 中每个 page 的 mobile wireframe:

- Landing mobile: static CSS gradient（no canvas）, text-4xl, full-width CTA h-14, vertical pain points, vertical how-it-works, 2×2 stats grid
- Assay mobile: accordion sections（one at a time）, variant card carousel 280px
- Experiment detail mobile: full-width vertical scorecard bars, scrollable pill tabs
- Lab mobile: full-width card stack, 4px left border color, pull-to-refresh, FAB, swipe-left archive
- Settings mobile: scrollable tab strip, single-column pricing plans
- Verdict mobile: text-5xl centered, fills viewport, scroll for details, no particles

## 2. Animation Choreography

### Sequence A: Spec Materializing（~3200ms）
t=0: skeleton visible
t=0: name crossfade (swap, 250ms)
t=200: pre-flight icons pop (scale-in, 150ms, ease-out-back, 300ms stagger)
t=1500: hypothesis cards stagger (fade-up, 400ms, 60ms stagger)
t=2300: variant cards (fade-up, 400ms, 100ms stagger)
t=2800: cost counters animate (ease-out-quart, 400ms)
t=3200: edit icons + buttons fade in

### Sequence B: Verdict Reveal（~3600ms）
t=0: previous content exits (fade-out, 150ms)
t=300: colored background fades in
t=400: verdict icon springs (scale 0→1, ease-spring, 600ms)
t=700: verdict word (letter-spacing contracts, 600ms)
t=1100: subtitle fades in
t=1500: scorecard bars fill (scaleX, 600ms, ease-out-quart, 200ms stagger)
t=2400: ROI summary fades up
t=2800: recommendation fades up
t=3200: action buttons appear
t=3600: CTA glow begins

Per-verdict modulation:
- SCALE: confetti at t=400 (desktop only)
- KILL: 15% slower, "You saved 3 months" underline
- REFINE: bottleneck bar pulses
- PIVOT: icon oscillates ±5px

### Sequence C: Scorecard Bar Update（~1200ms）
Previous → new value transition via scaleX。Color shift at 1.0x threshold。

npm run build 零错误。
```

---

### Session 12c — Visual Verification

**目标**：实现 reduced motion support、performance budget、visual verification pass。

**输入**：Session 12b 的 animation + mobile wireframes

**输出**：
- Reduced motion support
- Performance budget enforcement
- Visual verification（screenshot → compare to wireframe → fix）

**输出合约**（Session 13 验证）：
```
@media (prefers-reduced-motion: reduce) block in globals.css
Performance budget: no width animations on scorecard bars (verify scaleX usage)
Visual verification pass completed for all 8 pages (desktop 1280px + mobile 375px)
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

读 docs/ux-design.md 的 Responsive & Mobile Design section（Reduced Motion 和 Performance Budget 部分）。
读 docs/CONVENTIONS.md。

用 /change 实现 reduced motion + performance + visual verification：

## 1. Reduced Motion

@media (prefers-reduced-motion: reduce):
- REMOVE: pulse-glow, float, particles, confetti, letter-spacing, stagger delays
- REPLACE: entrances → opacity 0→1 in 1ms, bars → jump, counters → instant
- KEEP: hover colors, shimmer (slowed), focus rings, color transitions (250ms)

useRevealOnScroll hook: check matchMedia, skip IntersectionObserver if reduced motion。

## 2. Performance Budget

- Max 12 simultaneous animations
- GPU-only: transform + opacity
- Scorecard bars: scaleX（never width）
- will-change: set on trigger, remove on animationend
- Mobile: halved stagger, reduced translateY (8px), shorter durations

## 3. Visual Verification Pass

对每个页面执行视觉验证：
a. 截取 desktop (1280px) 和 mobile (375px) screenshots
b. 对比 ux-design.md 中的 ASCII wireframes
c. 检查：布局对齐、间距一致、颜色正确、字体大小、touch targets ≥ 44px
d. 修复偏差

关注点：
- Landing page above-the-fold 只有一个输入框（不能有 noise）
- Verdict page fills viewport（no scroll needed for verdict word）
- Lab cards 信息密度正确（ONE number per card）
- Experiment page scorecard bars 使用 scaleX（not width）
- Mobile tab bar 在 keyboard open 时隐藏

npm run build 零错误。
```

---

### [CP5] Checkpoint: Complete Application

**验证范围**：Sessions 1-12c 的全部输出（完整应用）。

**检查项**：
1. `npm run build` 零错误
2. `npx tsc --noEmit` 零错误
3. `npx vitest run` 通过
4. 所有 8 个页面 desktop + mobile 渲染无错误
5. 6 个 mobile components 存在且功能正常
6. CSS timing tokens 存在于 globals.css
7. Animation sequences A/B/C 可触发
8. Reduced motion 模式下动画正确降级
9. 所有 API routes 返回正确 HTTP status
10. Cron routes 存在（metrics-sync, cleanup, notifications, cost-monitor, hosting-billing）
11. Docker image spec 存在
12. 所有环境变量在 .env.example 中记录

**输出**：CP5 verification report。这是最终 checkpoint — 修复所有问题后进入 /harden + /verify。

---

## Phase 8: Quality + Deploy

### Session 13 — /harden + /verify

**目标**：加固和验证。

**输入**：Session 1-12 的完整代码

**输出**：
- Security hardening（RLS 审查、input validation、rate limiting 审查）
- Specification tests for critical paths
- E2E tests passing
- Build passing

**输出合约**（Session 14 验证）：
```
.github/workflows/ci.yml    → exists with build, typecheck, vitest, playwright jobs
npm run build                → zero errors
npx tsc --noEmit             → zero errors
npx vitest run               → all tests pass
npx playwright test          → all tests pass
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

## Pre-harden: Sentry Error Monitoring

1. npm install @sentry/nextjs
2. npx @sentry/wizard@latest -i nextjs
3. .env.example 添加 SENTRY_DSN, SENTRY_AUTH_TOKEN
4. npm run build 通过

## Pre-harden: GitHub Actions CI

创建 `.github/workflows/ci.yml`:
- Trigger: pull_request to main
- Jobs: build, lint, typecheck, vitest, playwright
- Steps:
  1. Checkout + setup Node 20 + npm ci
  2. `npm run build` — zero errors
  3. `npx tsc --noEmit` — typecheck
  4. `npx vitest run` — unit/spec tests
  5. `npx playwright install --with-deps && npx playwright test` — E2E tests
- Environment: use `.env.example` values + test-specific overrides
- Playwright 使用 `npx playwright install --with-deps` 安装 browsers in CI
- Cache: node_modules + .next/cache + playwright browsers

然后运行 /harden。

Harden 完成后，运行 /verify。

关注的 critical paths（quality: production 要求 spec tests）:
- Auth flow（signup, login, token refresh）
- Billing flow（authorize → execute → complete, PAYG deduction, pool management）
- Spec streaming（SSE protocol, anonymous spec storage, claim）
- Skill execution（trigger → progress → gate → approve → complete）
- Metrics sync（scorecard computation, alert detection, verdict engine）

/verify 应该并行运行 6 个 agents:
1. behavior-verifier
2. security-defender
3. security-attacker
4. accessibility-scanner
5. performance-reporter
6. spec-reviewer（quality: production 额外添加）

修复所有发现的问题，直到 build + tests 全部通过。

npm run build 零错误。npx vitest run 通过。npx playwright test 通过。
```

---

### Session 14 — /deploy + Validation

**目标**：部署到 production 并验证。

**输入**：Session 13 的 hardened code

**输出**：
- 部署到 Vercel（assayer.io）
- Supabase production 配置
- 环境变量全部配置
- Smoke test 通过

**输出合约**（Post-deploy 验证）：
```
assayer.io                   → Landing page loads
SSE spec stream              → returns events for test idea
Supabase RLS                 → enforced on all tables
Stripe webhook               → reachable
Cron jobs                    → registered in Vercel
```

**Prompt**:

```
先读 docs/assayer-session-prompts.md 中本 session 的「输出合约」和前序 session 的「输出合约」，执行文件顶部 "Session Preamble Template" 中的合约验证步骤。

运行 /deploy。

部署前确认所有环境变量已在 .env.example 中记录:

## Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

## Auth (Supabase handles, but need OAuth apps configured)
# Google OAuth: configured in Supabase dashboard
# GitHub OAuth: configured in Supabase dashboard

## Analytics
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST

## AI
ANTHROPIC_API_KEY

## Payments
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
STRIPE_TEAM_PRICE_ID

## Cloud Run Jobs
GCP_PROJECT_ID
GCP_REGION
CLOUD_RUN_JOB_NAME
GCP_SA_KEY

## Railway (for AI agent / long-running experiments)
RAILWAY_TOKEN

## Distribution
TWITTER_CLIENT_ID
TWITTER_CLIENT_SECRET
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
RESEND_API_KEY
GOOGLE_ADS_MCC_ID
GOOGLE_ADS_CLIENT_ID
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_DEVELOPER_TOKEN
META_APP_ID
META_APP_SECRET
TWITTER_ADS_CONSUMER_KEY
TWITTER_ADS_CONSUMER_SECRET

## Cron
CRON_SECRET

## DNS (Railway experiments)
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID

## Monitoring
SENTRY_DSN
SENTRY_AUTH_TOKEN

部署后验证:
1. Landing page 加载（assayer.io）
2. SSE spec stream 工作（输入 idea → 看到 events）
3. Signup 流程（Google/GitHub OAuth + email）
4. Spec claim 成功
5. Lab page 渲染
6. Settings page 渲染
7. Stripe webhook 可达
8. Supabase RLS 生效
9. Cron jobs 注册
10. Railway CLI 认证成功（`railway whoami`）
11. 创建测试 Railway project 验证 token 有效

如果任何验证失败，修复并重新部署。
```

---

## Appendix: 完整性审查

### Pages（8 pages，来自 product-design.md Section 6）

| Page | Session | Route |
|------|---------|-------|
| landing | S5 | / |
| assay | S5 | /assay |
| launch | S6a | /launch/[id] |
| experiment | S6b | /experiment/[id] |
| verdict | S7 | /verdict/[id] |
| lab | S7 | /lab |
| compare | S7 | /compare |
| settings | S7 | /settings |

### API Routes（~40 routes，来自 product-design.md Section 5）

| Route Group | Session | Routes |
|-------------|---------|--------|
| Spec (anonymous) | S4 | POST /api/spec/stream, POST /api/spec/claim |
| Experiments CRUD | S3 | GET/POST/PATCH/DELETE /api/experiments, GET /api/experiments/:id |
| Hypotheses | S3 | POST/GET /api/experiments/:id/hypotheses |
| Variants | S3 | POST/GET /api/experiments/:id/variants |
| Insights | S3 | POST/GET /api/experiments/:id/insights |
| Research | S3 | POST/GET /api/experiments/:id/research |
| Rounds | S3 | GET/POST /api/experiments/:id/rounds |
| Metrics | S11 | POST /api/experiments/:id/metrics/sync(?force_verdict=true), GET /api/experiments/:id/metrics |
| Metrics Export | S7 | GET /api/experiments/:id/metrics/export (CSV download) |
| Skills | S9a | POST /api/skills/execute, GET /api/skills/:id, POST /api/skills/:id/approve, POST /api/skills/:id/cancel |
| Distribution | S10 | GET /api/experiments/:id/distribution, POST .../sync, POST .../manage |
| Alerts | S11 | GET /api/experiments/:id/alerts, PATCH .../alerts/:alertId |
| Compare | S7 | GET /api/experiments/compare |
| Billing | S8, S9a | POST /api/operations/authorize, POST .../complete, POST /api/operations/:id/extend, GET /api/billing/usage, POST .../subscribe, POST .../topup, POST .../portal |
| Notifications | S11 | GET /api/notifications, PATCH /api/notifications/:id, POST /api/notifications/mark-all-read |
| Webhooks | S8 | POST /api/webhooks/stripe |
| Cron | S11 | /api/cron/metrics-sync, /api/cron/cleanup, /api/cron/notifications, /api/cron/cost-monitor, /api/cron/hosting-billing |

### DB Tables（17 tables，来自 product-design.md Section 6）

| Table | Session |
|-------|---------|
| anonymous_specs | S3 |
| experiments | S3 |
| experiment_rounds | S3 |
| hypotheses | S3 |
| hypothesis_dependencies | S3 |
| research_results | S3 |
| variants | S3 |
| experiment_metric_snapshots | S3 |
| experiment_decisions | S3 |
| experiment_alerts | S3 |
| notifications | S3 |
| ai_usage | S3 |
| user_billing | S3 |
| operation_ledger | S3 |
| skill_executions | S3 |
| oauth_tokens | S3 |
| distribution_campaigns | S3 |

### Environment Variables（S14 deploy checklist 列出全部）

| Category | Variables | Session |
|----------|-----------|---------|
| Supabase | NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY | S2 |
| Analytics | NEXT_PUBLIC_POSTHOG_KEY, HOST | S2 |
| AI | ANTHROPIC_API_KEY | S4 |
| Payments | STRIPE_SECRET_KEY, PUBLISHABLE_KEY, WEBHOOK_SECRET, PRO_PRICE_ID, TEAM_PRICE_ID | S8 |
| Cloud Run | GCP_PROJECT_ID, REGION, JOB_NAME, SA_KEY | S9a |
| Distribution (organic) | TWITTER_CLIENT_ID/SECRET, REDDIT_CLIENT_ID/SECRET, RESEND_API_KEY | S10 |
| Distribution (paid) | GOOGLE_ADS_*, META_*, TWITTER_ADS_* | S10 |
| Cron | CRON_SECRET | S11 |
| DNS | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID | S9b |
| Monitoring | SENTRY_DSN, SENTRY_AUTH_TOKEN | S13 |

### UX Flows Covered

| Flow (product-design.md) | Session |
|--------------------------|---------|
| Flow 1: Idea → Spec (SSE) | S4, S5 |
| Flow 2: Signup Gate → Spec Recovery | S5 |
| Flow 3: Build → Deploy → Distribute | S6a, S9a, S9b, S10 |
| Flow 4: Metrics Sync + Scorecard + Alerts | S11 |
| Flow 5: Verdict → Return Flows | S7, S11 |
| Flow 6: /iterate Skill (per-hypothesis verdicts) | S11 |

### UX Screens Covered

| Screen (ux-design.md) | Session |
|------------------------|---------|
| Screen 1: Landing | S5 |
| Screen 2: The Assay (creation + edit mode) | S5 |
| Screen 3: Signup Gate (+ TOTP 2FA) | S5 |
| Screen 5: Build & Launch | S6a |
| Screen 6: Experiment Page | S6b |
| Screen 7: Verdict | S7 |
| Screen 7a: Return Flows | S7 |
| Screen 8: Lab | S7 |
| Screen 9: Settings | S7 |
| Experiment Comparison | S7 |
| Error & Edge States | S6b (alert banners) |
| Notifications | S11 |
| Responsive & Mobile | S12a, S12b |
| Animation Timing | S12b, S12c |

### Checkpoint Coverage Matrix

| Checkpoint | Verifies Sessions | Key Focus |
|------------|-------------------|-----------|
| [CP1] | S1-S4 | Data layer + API foundation |
| [CP2] | S5-S6b | UI pages + SSE streaming |
| [CP3] | S5-S8 | Full UI + billing integration |
| [CP4] | S9a-S10 | Skill execution + distribution |
| [CP5] | S1-S12c | Complete application (pre-harden) |
