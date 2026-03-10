# Assayer Implementation — World-Champion Session Prompts

> 12 sessions. Each prompt is a self-contained Claude Code instruction.
> Run one prompt per conversation. Each produces 1+ PRs.
> Read `docs/assayer-product-design.md` before starting any session.

## First-Principles Gap Analysis

### What EXISTS (template repo — workflow/)
- 11 lifecycle skills (spec, bootstrap, change, verify, deploy, distribute, iterate, teardown, harden, retro, review)
- 20+ review/scaffold agents
- 3 archetypes (web-app, service, cli)
- 25+ stack files (nextjs, vercel, supabase, posthog, shadcn, stripe, etc.)
- Production quality mode designed (3-PR spec in memory) but NOT yet implemented
- /spec skill exists and is designed
- /iterate has per-hypothesis verdicts (PR #264)
- Deploy interface is hosting-agnostic (PRs #176-178)
- Skills are stateless transformers — return JSON, caller handles persistence
- `ASSAYER_API_URL` is purely a platform-mode signal (skip interactive prompts), NOT for skills to call APIs

### True Gaps (2)

**Gap A: Template Dependency** — Production quality mode 3-PR sequence (patterns → agents → wiring+harden) is designed but not implemented. Assayer requires `quality: production` from Day 1.

**Gap B: Platform Code** — The entire Assayer web application:
- 5 pages (landing, dashboard, new-experiment, experiment detail, settings)
- 30+ API routes (experiments CRUD, hypotheses, research, metrics sync, AI spec generation)
- 9 database tables + RLS policies
- Auth (Supabase + Google/GitHub OAuth)
- AI integration (Anthropic SDK — server-side spec generation endpoint)
- PostHog read API (server-side metrics query for sync endpoint)

### Critical Ordering Decision

**Template-first, then Platform.** Rationale:
- Production quality mode (TDD, implementer agents, spec-reviewer) should exist BEFORE bootstrapping Assayer
- Assayer with `quality: production` gets specification tests from Day 1
- 3-PR sequence is low-risk (designed, validated by 5-agent review)
- Template work stays in workflow repo; Assayer is a new repo

## Session Architecture: 12 Sessions

```
Phase 0: Template Finalization (workflow repo)
  Session 0: Production Quality Mode (3 PRs → patterns, agents, wiring)

Phase 1: Assayer Repo + Spec
  Session 1: Create repo + /spec → experiment.yaml
  Session 2: Review + finalize experiment.yaml

Phase 2: Bootstrap + Core Infrastructure
  Session 3: /bootstrap → full scaffold
  Session 4: Error schema + API auth middleware
  Session 5: Experiments + Hypotheses + Clusters CRUD  ─┐ parallelizable
  Session 6: Research + Offers + Metrics + AI Spec     ─┘

Phase 3: Feature Build
  Session 7: New Experiment page (AI wizard)  ─┐ parallelizable
  Session 8: Dashboard + Experiment Detail    ─┘
  Session 9: PostHog metrics sync + Settings page

Phase 4: Quality + Deploy
  Session 10: /harden + /verify
  Session 11: /deploy to assayer.io

Phase 5: Validation
  Session 12: First real experiment on Assayer
```

Critical path: 10 sessions (Sessions 5+6 and 7+8 can parallelize).

---

## Session 0: Production Quality Mode (workflow repo)

**Repo:** `/Users/quanpeng/claude_projects/workflow`
**Produces:** 3 sequential PRs (patterns → agents → wiring+harden)
**Prerequisite:** None

```
你是世界冠军级别的软件架构师。你的任务是在 mvp-template 中实现 production quality 模式。

## 背景
`memory/production-quality-implementation.md` 包含完整的 3-PR 实施规范，已通过 5-agent 首要原则审查验证。
这是为 Assayer 平台做准备——Assayer 将使用 `quality: production` 从第一天开始构建。

## 任务：按顺序执行 3 个 PR

### PR 1: feat/production-patterns
创建 2 个纯文档文件（零运行时影响）：

1. `.claude/patterns/tdd.md`
   - RED-GREEN-REFACTOR 循环
   - Specification tests vs regression tests vs characterization tests
   - 任务粒度（2-5 分钟）
   - 任务依赖排序（依赖图分析）
   - 测试类型选择表
   - 不该测试的内容（UI渲染、静态内容、框架模板）
   参考格式：读 `.claude/patterns/verify.md` 和 `.claude/patterns/design.md`

2. `.claude/patterns/systematic-debugging.md`（不受 quality 条件限制——所有项目可用）
   - 4 阶段根因分析：Observe → Hypothesize → Test → Fix
   - 反模式：shotgun debugging、修复症状而非根因、跳过观察阶段
   参考格式同上

用 /review 验证。合并后继续 PR 2。

### PR 2: feat/production-agents
创建 2 个 agent 文件（创建但不激活，直到 PR 3 接线）：

1. `.claude/agents/implementer.md`
   - TDD-aware 子代理，由 /change (production mode) 和 /harden 生成
   - isolation: "worktree"
   - 输入：任务描述（精确文件路径 + 规格说明 + 预期失败消息）
   - 执行：读现有代码 → 写 spec test (RED) → 最小代码 (GREEN) → 重构 → 自审 → 提交
   - Bug 发现协议：如果 spec test 揭示现有代码有 bug → 修复代码（这就是 hardening 的目的）
   参考格式：读 `.claude/agents/security-defender.md` 和 `.claude/agents/ux-journeyer.md`

2. `.claude/agents/spec-reviewer.md`
   - 只读验证代理（6 项检查）：
     a. 每个 experiment.yaml feature 有对应实现
     b. 每个 page/endpoint/command 存在
     c. 每个 EVENTS.yaml 事件有 tracking 调用
     d. golden_path 步骤可达
     e. system/cron behaviors 有实现
     f. 如果 .claude/current-plan.md 存在：每项都已处理
   参考格式同上

用 /review 验证。合并后继续 PR 3。

### PR 3: feat/production-quality-mode
创建 1 个文件 + 修改 6 个文件（所有更改在 `quality: production` 条件后面）：

**创建：** `.claude/commands/harden.md`
- 闭环技能：scan → plan → approve → auto-execute → verify → PR
- 完整规格在 `docs/assayer-product-design.md` 和 `memory/production-quality-implementation.md`

**修改：**
1. `CLAUDE.md` Rule 4 — 添加 quality: production 条件块
2. `commands/change.md` — Step 3 添加 "harden" 分类说明, Step 4 添加 stack.testing 前置条件, Step 6 Feature/Fix/Upgrade 添加 production path, Step 7 添加 spec-reviewer, Step 8 延迟删除 current-plan.md
3. `commands/bootstrap.md` — Phase 1 添加 stack.testing 验证, Phase 2 添加 production-mode 指导
4. `patterns/verify.md` — 添加第 6 个 agent (spec-reviewer) 条件
5. `experiment/experiment.yaml` — 添加 quality 字段（注释掉默认）
6. `commands/iterate.md` — SCALE 判定推荐 /harden

读 `memory/production-quality-implementation.md` 获取每个文件的精确修改内容和 8 个边缘情况防护栏。

用 /review 验证。确保 `npm run build` 通过（如果有 build 的话）。
验证所有脚本 `make validate` 仍然通过。
```

---

## Session 1: Create Assayer Repo + /spec

**Repo:** 新建 `assayer-io`
**Produces:** 1 PR (feat/spec)
**Prerequisite:** Session 0 complete

```
你是世界冠军级别的产品架构师。你的任务是创建 Assayer 平台仓库并生成完整的实验规格。

## Step 1: 创建仓库

mkdir -p ~/claude_projects/assayer-io && cd ~/claude_projects/assayer-io
git init
gh repo create magpiexyz-lab/assayer-io --private --source=. --push

## Step 2: 复制模板基础设施

从 /Users/quanpeng/claude_projects/workflow/ 复制以下目录和文件：
- .claude/ (整个目录)
- CLAUDE.md
- EVENTS.yaml (如果存在)
- Makefile
- .github/ (PR 模板等)

不要复制：docs/、scripts/、tests/fixtures/ (这些是模板验证专用)

## Step 3: 运行 /spec

用以下 idea 运行 /spec：

Idea: "Assayer is an AI-powered MVP validation platform for indie hackers and startup founders. Users describe a business idea in plain text, and AI generates a complete experiment specification — hypotheses with testable thresholds, user behaviors as given/when/then, A/B messaging variants, and the optimal tech stack. Users then scaffold code, deploy to a subdomain, drive traffic via ads, and get AI-powered funnel scorecards with per-hypothesis verdicts (CONFIRMED/REJECTED/INCONCLUSIVE). The platform recommends whether to SCALE, REFINE, PIVOT, or KILL based on data, not gut feel. Think of it as the scientific method for startups. 5 core pages: landing (product intro + signup), dashboard (experiment portfolio), new-experiment (2-step AI wizard), experiment detail (tabs: overview, hypotheses, variants, data, insights), and settings (account + billing). Revenue: $29/mo Pro plan for 50 active experiments."

Level: 3
Type: web-app
Quality: production

## Step 4: 校准 experiment.yaml

/spec 生成 YAML 后，对照 docs/assayer-product-design.md 交叉验证：

### 必须包含的 hypotheses：
- h-demand: "Indie hackers actively search for MVP validation tools" (>5% signup rate from 500+ visitors)
- h-reach: "Startup validation keywords have sufficient search volume" (>2% ad CTR)
- h-feasibility: "AI can generate useful experiment specs from 2-sentence ideas" (>70% user acceptance of generated spec)
- h-monetize: "Founders will pay $29/mo for structured validation" (>3% pricing page interaction)
- h-retain: "Users run 2+ experiments within 30 days" (>30% return rate)

### 必须包含的 behaviors（从设计文档 Section 5 推导）：
- 用户行为：landing 访问、signup、create experiment、review AI spec、edit spec、deploy experiment、view dashboard、view funnel data、analyze results
- 系统行为：AI spec generation (actor: system)、PostHog metrics sync (actor: cron, trigger: "every 15 minutes")、experiment status transitions

### golden_path：
landing → signup → new-experiment (step 1) → new-experiment (step 2: AI generates) → experiment detail → dashboard

### Stack 必须包含：
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
# payment: stripe  # L3, 先注释

quality: production

创建 PR feat/spec，合并到 main。
```

---

## Session 2: Review + Finalize experiment.yaml

**Repo:** `assayer-io`
**Produces:** 直接 commit（pre-bootstrap 调整）
**Prerequisite:** Session 1 PR merged

```
你是世界冠军级别的实验设计师。你的任务是精修 experiment.yaml，确保它和设计文档 100% 对齐。

## 读取

1. 读 experiment/experiment.yaml（Session 1 /spec 的输出）
2. 读 /Users/quanpeng/claude_projects/workflow/docs/assayer-product-design.md 的以下部分：
   - Section 4: API & Data Flow（30 个 API routes）
   - Section 5: Data Model（9 张表的 SQL）
   - Section 8: UX Reference（wireframes）

## 交叉验证清单

逐项检查并修复：

### API 路由覆盖
设计文档列出的每个路由必须在 behaviors 中有对应：
- GET/POST/PATCH/DELETE /api/experiments → experiments CRUD behavior
- POST/GET /api/experiments/:id/hypotheses → hypothesis management behavior
- POST/GET /api/experiments/:id/offers → variant management behavior
- POST/GET /api/experiments/:id/research → research storage behavior
- POST/GET /api/experiments/:id/insights → decision storage behavior
- POST /api/experiments/:id/metrics/sync → metrics sync (system actor, cron trigger)
- POST /api/experiments/:id/spec → AI spec generation (system actor)

### 数据模型覆盖
设计文档的 9 张表必须被至少一个 behavior 引用：
experiments, clusters, hypotheses, hypothesis_dependencies, research_results, variants, experiment_metrics, experiment_decisions, ai_usage

### Pages 覆盖
golden_path 必须包含所有 5 个页面：landing, dashboard, new-experiment, experiment (detail), settings

### Funnel 配置
funnel:
  reach: metric: "Ad CTR", threshold: "> 2%", available_from: L1
  demand: metric: "Signup conversion rate", threshold: "> 5%", available_from: L1
  monetize: metric: "Pricing page interaction rate", threshold: "> 3%", available_from: L2
  retain: metric: "30-day return rate", threshold: "> 30%", available_from: L3

### Variant 要求
至少 3 个 variants，headline 词汇差异 > 30%：
- 效率角度：如 "Validate Ideas 10x Faster"
- 数据驱动角度：如 "Data-Driven Product Decisions"
- 风险规避角度：如 "Stop Wasting Money on Ideas Nobody Wants"

## 输出
所有修改直接 commit 到 main（这是 pre-bootstrap 阶段，不需要 PR）。
确保 `make validate` 通过（如果 Makefile 中有 validate target）。
```

---

## Session 3: /bootstrap Assayer Platform

**Repo:** `assayer-io`
**Produces:** 1 PR (feat/bootstrap)
**Prerequisite:** Session 2 complete

```
你是世界冠军级别的全栈工程师。你的任务是用 /bootstrap 从 experiment.yaml 构建完整的 Assayer 平台。

## 前置检查
1. 确认 experiment/experiment.yaml 在 main 分支上且内容完整
2. 确认 quality: production 已设置
3. 确认 stack.testing 存在（production 的前置条件）

## 运行 /bootstrap

/bootstrap

## 审查 bootstrap 计划时的检查清单

当 bootstrap 呈现计划时，验证以下内容：

### 页面（5 个）
- [ ] landing — 产品介绍 + signup CTA + variants A/B
- [ ] dashboard — 实验网格 + 状态过滤 + 空状态
- [ ] new-experiment — 2-step 向导（describe → review AI output）
- [ ] experiment/[id] — 详情页 with tabs (overview, hypotheses, variants, data, insights)
- [ ] settings — 账户 + 安全 + billing placeholder

### 数据库（9 张表）
- [ ] experiments (user_id, name, type, status, level, decision, deployed_url, archived_at)
- [ ] clusters (experiment_id, cluster_key, level, stimulus_format)
- [ ] hypotheses (experiment_id, hypothesis_key, category, statement, threshold, status)
- [ ] hypothesis_dependencies (hypothesis_id, depends_on_id)
- [ ] research_results (experiment_id, query, summary, verdict)
- [ ] variants (experiment_id, slug, headline, subheadline, cta, pain_points)
- [ ] experiment_metrics (experiment_id, metric_name, value, sample_size, fetched_at)
- [ ] experiment_decisions (experiment_id, decision, reach/demand/monetize/retain ratios)
- [ ] ai_usage (user_id, experiment_id, skill_name, tokens, cost)
- [ ] oauth_tokens (user_id, provider, access_token, refresh_token)
所有表必须有 RLS policy (user_id = auth.uid())

### Auth
- [ ] Supabase Auth 配置 email + password
- [ ] Google OAuth provider
- [ ] GitHub OAuth provider
- [ ] Protected routes middleware

### Analytics
- [ ] PostHog 初始化
- [ ] 所有 EVENTS.yaml 事件 wired

### External Dependencies
回答 "PostHog = core, Google OAuth = core, GitHub OAuth = core, Stripe = skip for now"

## 批准计划，让 bootstrap 运行。

Bootstrap 完成后：
1. 确认 `npm run build` 通过
2. 确认所有 scaffold 子代理成功完成
3. 审查 PR 中的文件列表，确保无遗漏
4. 合并 PR
```

---

## Session 4: Error Schema + API Auth Middleware

**Repo:** `assayer-io`
**Produces:** 1 PR (change/error-schema-api-auth)
**Prerequisite:** Session 3 PR merged

```
你是世界冠军级别的 API 设计师。你的任务是建立 Assayer 的 API 基础设施：标准化错误模式和认证中间件。

/change 添加标准化 API 错误模式和认证中间件

## 错误模式（设计文档 Section 4）

创建 `src/lib/api-error.ts`：

所有 API 路由的错误响应格式：
{ "error": { "code": string, "message": string, "details": object } }

错误码枚举：
- validation_error (400) — zod 验证失败
- not_found (404) — 资源不存在
- unauthorized (401) — 未认证或无权限
- rate_limited (429) — 频率限制
- ai_error (502) — AI 调用失败
- internal_error (500) — 未预期的服务器错误

提供辅助函数：
- apiError(code, message, details?) → NextResponse
- withErrorHandler(handler) → 包装 route handler，捕获未处理异常返回 internal_error

## API 认证

创建 `src/lib/api-auth.ts`：

两层认证：
1. Supabase Auth（用户会话）— 所有前端请求通过 cookie
2. API Key（服务间调用）— Authorization: Bearer <ASSAYER_API_KEY>

提供中间件：
- withAuth(handler) → 验证 Supabase 会话或 API key
- getCurrentUser(request) → 返回 authenticated user 或 null

环境变量添加到 .env.example：
- ASSAYER_API_KEY=<generate-random-key>

## Rate Limiting

创建 `src/lib/rate-limit.ts`：

对 AI 端点的内存级频率限制（MVP 足够，无需 Redis）：
- /api/experiments/:id/spec — 10 requests/minute/experiment
- 使用简单的 Map<string, { count, resetAt }> 实现
- 提供 withRateLimit(key, limit, windowMs)(handler) 包装器

## 验证
确保 npm run build 通过。所有中间件可组合：
withAuth(withRateLimit("spec", 10, 60000)(withErrorHandler(handler)))
```

---

## Session 5: Experiments + Hypotheses + Clusters CRUD

**Repo:** `assayer-io`
**Produces:** 1 PR (change/experiments-crud)
**Prerequisite:** Session 4 PR merged
**可与 Session 6 并行**

```
你是世界冠军级别的后端工程师。你的任务是实现 Assayer 的核心数据 CRUD API。

/change 实现 experiments、hypotheses 和 clusters 的 CRUD API 路由

## 精确路由规格（设计文档 Section 4）

### Experiments
GET    /api/experiments           — 分页列表（?page=1&limit=20, max 100）
                                    过滤：?status=active|draft|completed|archived
                                    排序：created_at desc（默认）
POST   /api/experiments           — 创建（必需：name, idea_text; 可选：experiment_type, experiment_level）
GET    /api/experiments/:id       — 获取单个（包含 hypotheses count, variants count）
PATCH  /api/experiments/:id       — 更新（status, deployed_url, decision, decision_reasoning）
                                    状态转换验证：draft→active, active→paused, active→completed, *→archived
DELETE /api/experiments/:id       — 软删除（设置 archived_at = now()）

### Hypotheses
POST   /api/experiments/:id/hypotheses  — 存储（mode=append 默认, mode=replace 先删后插）
                                          Body: { hypotheses: [...], mode?: "append"|"replace" }
GET    /api/experiments/:id/hypotheses  — 列表（包含 depends_on 关系）

### Clusters
POST   /api/experiments/:id/clusters    — 存储（同上 mode 模式）
GET    /api/experiments/:id/clusters    — 列表

## Zod Schema

每个路由入参都用 zod 验证。关键 schema：

experimentCreateSchema: { name: z.string().min(1).max(200), idea_text: z.string().min(20), experiment_type: z.enum(["web-app", "service", "cli"]).default("web-app"), experiment_level: z.number().int().min(1).max(3).optional() }

experimentUpdateSchema: { status, deployed_url, decision, decision_reasoning — 全部 optional }
状态转换矩阵硬编码验证。

hypothesisSchema: { hypothesis_key, category: z.enum(["demand","reach","feasibility","monetize","retain"]), statement, success_metric, threshold, priority_score: z.number().int().min(0).max(100), experiment_level, depends_on: z.array(z.string()).default([]) }

## Supabase 数据层

- 使用 Supabase JS client（@supabase/supabase-js）
- 服务端用 createServerClient（from @supabase/ssr）
- 所有查询通过 RLS 自动过滤 user_id
- hypothesis_dependencies 表在 POST hypotheses 时自动管理（解析 depends_on 数组 → 查找对应 hypothesis_id → 插入依赖关系）

## 测试（quality: production）
由于 quality: production，关键的数据变更路由需要 specification tests：
- 实验创建验证（zod 拒绝无效输入）
- 状态转换矩阵（非法转换被拒绝）
- 软删除行为（archived_at 被设置，GET 默认不返回已归档）
- 假设依赖关系正确存储和查询

所有路由使用 Session 4 的 withAuth + withErrorHandler 中间件。
确保 npm run build 和 npm test 通过。
```

---

## Session 6: Research + Offers + Metrics + AI Spec Endpoint

**Repo:** `assayer-io`
**Produces:** 1 PR (change/research-offers-metrics-ai)
**Prerequisite:** Session 4 PR merged
**可与 Session 5 并行**

```
你是世界冠军级别的 AI 集成工程师。你的任务是实现 Assayer 的数据存储 + AI 规格生成端点。

/change 实现 research、offers、metrics 和 AI spec generation API 路由

## 路由规格

### Research Results
POST   /api/experiments/:id/research    — 存储研究结果（mode: append|replace）
GET    /api/experiments/:id/research    — 列表

researchSchema: { query: string, summary: string, sources: string[], confidence: "high"|"medium"|"low", verdict: "confirmed"|"rejected"|"inconclusive", hypothesis_id?: string }

### Offers (Variants)
POST   /api/experiments/:id/offers      — 存储变体（mode: append|replace）
GET    /api/experiments/:id/offers      — 列表

variantSchema: { slug: string, headline: string, subheadline?: string, cta: string, pain_points?: string, promise?: string, proof?: string, urgency?: string, pricing_amount?: number, pricing_model?: string }

### Insights (Decisions)
POST   /api/experiments/:id/insights    — 存储 scorecard + 决策
GET    /api/experiments/:id/insights    — 历史列表（时间倒序）

decisionSchema: { decision: "scale"|"refine"|"pivot"|"kill", reach_ratio, demand_ratio, monetize_ratio, retain_ratio, bottleneck_dimension?, reasoning, next_steps, confidence levels, sample sizes }

### Metrics Sync（PostHog 集成）
POST   /api/experiments/:id/metrics/sync  — 查询 PostHog，缓存到 experiment_metrics
GET    /api/experiments/:id/metrics       — 返回缓存的指标

逻辑：
1. 检查 experiment_metrics.fetched_at，如果 < 15min 且无 ?force=true，返回缓存
2. 否则调用 PostHog API：
   - 使用 POSTHOG_PERSONAL_API_KEY（私有 API，不是公开的 project key）
   - POST https://app.posthog.com/api/projects/{project_id}/query
   - HogQL 查询：按事件类型聚合 count，过滤 experiment_name property
3. 将结果存入 experiment_metrics 表
4. 返回最新指标

### AI Spec Generation
POST   /api/experiments/:id/spec        — AI 生成实验规格（无持久化）

逻辑：
1. Rate limit 检查（10/min/experiment，使用 Session 4 的 withRateLimit）
2. 读取请求 body：{ idea_text: string, level?: 1|2|3, type?: string }
3. 调用 Anthropic API（使用 @anthropic-ai/sdk）：
   - model: "claude-sonnet-4-20250514"（生成任务用 Sonnet 足够，省成本）
   - system prompt: 你是 Assayer 的实验设计 AI（从 /spec skill 逻辑提取）
   - 输出 JSON：hypotheses[], behaviors[], variants[], funnel{}, stack{}
4. Zod 验证输出。如果失败，重试一次。第二次失败返回 ai_error。
5. 记录到 ai_usage 表（user_id, experiment_id, tokens, cost）
6. 返回生成的 spec JSON（不持久化——前端决定是否保存）

环境变量添加到 .env.example：
- ANTHROPIC_API_KEY=sk-ant-...
- POSTHOG_PERSONAL_API_KEY=phx_...
- POSTHOG_PROJECT_ID=...

## 测试
- AI spec endpoint：mock Anthropic 调用，验证 zod 验证和重试逻辑
- Metrics sync：mock PostHog API，验证缓存行为（<15min 返回缓存，>15min 重新查询）
- Rate limiting：验证第 11 次请求被 429 拒绝

确保 npm run build 和 npm test 通过。
```

---

## Session 7: New Experiment Page (AI Wizard)

**Repo:** `assayer-io`
**Produces:** 1 PR (change/new-experiment-page)
**Prerequisite:** Sessions 5 + 6 merged
**可与 Session 8 并行**

```
你是世界冠军级别的前端工程师 + 交互设计师。你的任务是构建 Assayer 最核心的页面——新实验向导。

/change 构建 2-step AI 驱动的新实验创建向导

## 页面：/new-experiment

### Step 1: Describe Your Idea

布局参考设计文档 Section 8 "New Experiment (2-Step Wizard)"：

- 大文本框（5 行）：idea 描述，placeholder "Describe your product idea in 2-3 sentences..."
- 示例 ideas 作为可点击 chips：[AI resume builder] [Meal prep planner] [SaaS analytics tool]
  点击 chip 填充文本框
- Type 选择器：web-app（默认）| service | cli
  用 shadcn ToggleGroup，每个选项有图标和简短说明
- Level 选择器：L1 Pitch（默认）| L2 Prototype | L3 Product
  用 shadcn RadioGroup，每个 level 显示：名称、费用估算、时间线
  参考设计文档 Section 1 的 Level 表

- [Generate Spec] 主按钮 — 调用 POST /api/experiments/:id/spec
  流程：先 POST /api/experiments 创建草稿实验，然后调用 spec 端点

- Loading 状态：
  骨架屏 + 进度指示器，分阶段显示：
  "Researching market..." → "Generating hypotheses..." → "Crafting variants..." → "Building spec..."
  （前端计时器模拟，实际等待 AI 响应，通常 15-30 秒）

### Step 2: Review & Create

AI 返回后显示完整 spec：

1. **Header**: 实验名（可编辑）+ level + type + 费用/时间估算
2. **Pre-flight checks**: 4 维度（Market, Problem, Competition, ICP）各有 ✓/⚠/✗ 和一句话总结
3. **Hypotheses 表格**: 每行显示 category badge + statement + threshold + priority
   每行可展开编辑（inline editing with shadcn Popover）
   可添加/删除假设
4. **Behaviors 列表**: given/when/then 格式，按 level 分组
   可折叠展示
5. **Variants 卡片**: 3-5 个卡片，每个显示 headline + subheadline + CTA
   可切换查看/编辑模式
6. **Stack 摘要**: 只读显示选中的技术栈

底部操作：
- [Regenerate] 次按钮 — 重新调用 AI（保留 idea，重新生成其余）
- [Create Experiment] 主按钮 — 依次调用：
  - PATCH /api/experiments/:id (更新 name, level, type)
  - POST /api/experiments/:id/hypotheses (mode: replace)
  - POST /api/experiments/:id/offers (mode: replace)
  - POST /api/experiments/:id/research (mode: replace)
  - 完成后跳转到 /experiment/:id

## 状态管理
- 用 React useState 管理 step + form data
- AI 响应存储在 local state，用户编辑也在 local state
- 只在 "Create Experiment" 时批量持久化到 API
- 错误处理：AI 调用失败 → 显示 error toast + 重试按钮

## 无障碍
- 所有表单元素有 label
- 加载状态有 aria-live region
- Tab 键可以导航所有交互元素
- Escape 关闭编辑弹出框

确保 npm run build 通过。手动验证页面渲染无错误。
```

---

## Session 8: Dashboard + Experiment Detail Pages

**Repo:** `assayer-io`
**Produces:** 1 PR (change/dashboard-experiment-detail)
**Prerequisite:** Sessions 5 + 6 merged
**可与 Session 7 并行**

```
你是世界冠军级别的数据可视化 + UI 工程师。你的任务是构建 Assayer 的仪表盘和实验详情页。

/change 构建 dashboard 和 experiment detail 页面

## 页面 1: /dashboard

### 布局
- 顶部：标题 "Your Experiments" + [New Experiment] 按钮
- 过滤栏：All | Active | Draft | Completed | Archived（用 shadcn Tabs）
- 实验卡片网格（responsive: 1列 mobile, 2列 tablet, 3列 desktop）
- 空状态："No experiments yet. Create your first one to start validating." + [Create Experiment] CTA

### 实验卡片
- 实验名（truncate 到 2 行）
- Status badge（颜色编码: draft=gray, active=green, paused=yellow, completed=blue, archived=red）
- Level badge: L1/L2/L3
- 关键指标：如果 active 且有 metrics，显示最高 funnel 维度的 ratio（如 "DEMAND 1.34x"）
- 创建时间（relative: "3 days ago"）
- 点击整个卡片跳转到 /experiment/:id

### 数据获取
- Server component: 初始加载从 Supabase 查询（利用 SSR）
- GET /api/experiments?status=<filter>&page=<page>&limit=12
- 下拉加载更多（infinite scroll 或 "Load more" 按钮）

## 页面 2: /experiment/[id]

### Header
- 实验名 + 状态 badge + level badge
- "Day X/Y" (started_at 到 now vs 预计天数)
- deployed_url link（如果 active）
- 操作按钮：[Pause] [View Site] [Analyze Early] [Upgrade Level]

### Tabs（5 个，用 shadcn Tabs）

#### Overview Tab（默认）
4 维度 funnel scorecard（设计文档 Section 8 "Monitoring" wireframe）：
每个维度一行：
- 维度名 + badge
- 指标: "actual / threshold" (如 "CTR 3.8% / 2.0%")
- 水平进度条：ratio * 100% 宽度，颜色编码 (green >=1.0, yellow 0.7-1.0, red <0.7)
- 状态: PASS / LOW / — (not tested)
- 样本量 + confidence (如 "reliable — 523 impressions")

Verdict 卡片：
- 大号字体显示决策: SCALE / REFINE / PIVOT / KILL
- Bottleneck 说明（如果非 SCALE）
- 推荐下一步
- 如果无 insights: "No analysis yet. Run /iterate or click Analyze."

#### Hypotheses Tab
每个假设一个 card：
- hypothesis_key badge + category badge
- Statement 文本
- Threshold: "> 5% signup rate"
- Status: pending(灰) | testing(蓝) | passed(绿) | failed(红) | skipped(灰)
- 如果有 depends_on: 显示依赖链 "Depends on: h-01, h-03"
- 如果依赖方 REJECTED: 显示 "BLOCKED — dependency h-01 rejected"

#### Variants Tab
每个 variant 一个 card（shadcn Card）：
- Headline（大号）
- Subheadline
- CTA 按钮样式预览
- Pain points, promise, proof（折叠详情）

#### Data Tab
- Metrics 表格：metric_name | value | sample_size | period | last_synced
- [Sync Metrics] 按钮 — 调用 POST /api/experiments/:id/metrics/sync
  loading 状态 + success/error toast
- 自动刷新：如果 fetched_at > 15min，页面加载时自动 sync

#### Insights Tab
- Decision 历史时间线（时间倒序）
- 每条记录：日期 + decision badge + reasoning + next_steps
- Funnel ratio 快照（reach/demand/monetize/retain 当时的值）

## 共享组件
- FunnelBar: 水平比率条组件（ratio, threshold, confidence, sampleSize）
- StatusBadge: 通用状态 badge
- ExperimentCard: 仪表盘用的实验卡片

确保 npm run build 通过。所有页面无运行时错误。
```

---

## Session 9: PostHog Metrics Sync + Settings Page

**Repo:** `assayer-io`
**Produces:** 1 PR (change/metrics-sync-settings)
**Prerequisite:** Session 8 merged

```
你是世界冠军级别的集成工程师。你的任务是完善 PostHog 指标同步的前端集成，并构建设置页面。

/change 完善 PostHog metrics sync 前端集成 + 构建 settings 页面

## PostHog Metrics Sync 前端

### Data Tab 增强（在 Session 8 基础上）
- [Sync Metrics] 按钮点击：
  1. 设置 loading 状态
  2. POST /api/experiments/:id/metrics/sync
  3. 成功 → 刷新 metrics 列表 + success toast "Metrics synced"
  4. 失败（PostHog 未配置） → error toast "Configure PostHog in settings"
  5. 失败（rate limit） → warning toast "Try again in a minute"

- 自动同步逻辑（在 useEffect 中）：
  1. GET /api/experiments/:id/metrics
  2. 如果任何 metric 的 fetched_at > 15min → 自动触发 sync
  3. 同步完成后更新 UI
  4. 不要在每次 tab 切换时都触发，只在首次打开和手动刷新时

- Metrics 表格改为实时感知：
  - 每个 metric 的 fetched_at 显示 relative time "2 min ago"
  - 全局 "Last synced: X minutes ago" 标注
  - 如果 > 15min: 显示 stale warning badge

### Overview Tab 增强
- Funnel scorecard 数据从 metrics + insights 联合获取：
  - Metrics 提供当前值（实际数字）
  - Insights 提供最近的 verdict + bottleneck
  - 如果无 insights 但有 metrics → 仅显示数字，不显示 verdict
- "Analyze" 按钮：提示用户在 CLI 运行 /iterate（MVP 阶段 AI 分析在 CLI 完成）

## Settings 页面: /settings

### Account Section
- 显示当前用户信息（email, created_at — 从 Supabase Auth 获取）
- Change password form（current password + new password + confirm）
  使用 Supabase Auth updateUser API

### Connected Accounts Section
- Google OAuth 连接状态
  - 已连接 → 显示 email + "Disconnect" 按钮
  - 未连接 → "Connect Google Account" 按钮
- GitHub OAuth 连接状态（同上）
- 状态通过 Supabase Auth user.identities 获取

### API Access Section
- 显示用户的 API key（用于 CLI 连接 Assayer API）
  - 显示时默认遮蔽 ****
  - "Show" 按钮揭示完整 key
  - "Regenerate" 按钮 — 确认对话框后生成新 key
- CLI 连接说明：
  "Set these environment variables in your experiment repo:"
  ASSAYER_API_URL=https://assayer.io
  ASSAYER_API_KEY=<your-key>

### Billing Section（placeholder）
- Card: "Billing — Coming Soon"
- "Free plan: 5 active experiments"
- "Pro plan ($29/mo): 50 active experiments — available soon"
- 不实现 Stripe 集成

## 导航增强
- 确保所有页面的 sidebar/header 导航链接正确：
  Dashboard | New Experiment | Settings
- 用户头像/名称 dropdown 在 header 右上角：Settings | Sign Out

确保 npm run build 通过。所有页面手动验证无运行时错误。
```

---

## Session 10: /harden + /verify

**Repo:** `assayer-io`
**Produces:** 1 PR (chore/harden-production)
**Prerequisite:** Sessions 3-9 所有 PR 合并

```
你是世界冠军级别的质量工程师。你的任务是用 /harden 将 Assayer 从 MVP 过渡到 production quality。

## 运行 /harden

/harden

## 预期 Critical 模块

/harden 会扫描 src/ 并分类模块。以下模块应被标记为 CRITICAL：

### 必须有 specification tests 的模块：
1. **Auth middleware** (src/lib/api-auth.ts)
   - 有效 session → 允许通过
   - 无效/过期 session → 401
   - 有效 API key → 允许通过
   - 无 auth → 401

2. **Error schema** (src/lib/api-error.ts)
   - 每个 error code → 对应 HTTP status
   - 未处理异常 → internal_error (500)

3. **Rate limiting** (src/lib/rate-limit.ts)
   - 在限额内 → 允许通过
   - 超过限额 → 429
   - 窗口过期后重置

4. **Experiments CRUD** (src/app/api/experiments/)
   - 创建：有效输入 → 201，无效 → 400
   - 状态转换：合法 → 200，非法 → 400
   - 软删除：设置 archived_at，后续 GET 默认不返回
   - 分页：page + limit 参数正确工作

5. **Hypotheses CRUD** (src/app/api/experiments/[id]/hypotheses/)
   - append 模式：追加不覆盖
   - replace 模式：先删后插
   - depends_on 关系正确存储

6. **Metrics sync** (src/app/api/experiments/[id]/metrics/sync/)
   - 缓存未过期 → 返回缓存（无 PostHog 调用）
   - 缓存过期 → 查询 PostHog + 更新缓存
   - force=true → 总是查询

7. **AI spec endpoint** (src/app/api/experiments/[id]/spec/)
   - 有效 idea → 返回 spec JSON
   - AI 返回无效 JSON → 重试一次
   - 两次失败 → ai_error
   - Rate limit 生效

### ON-TOUCH 模块（修改时才加测试）：
- UI 组件（FunnelBar, StatusBadge, ExperimentCard）
- Settings 页面逻辑
- Navigation 组件

## 审查 hardening 计划

当 /harden 呈现计划时，确认：
- Critical 模块列表正确
- 每个模块的 specification test 描述有意义
- 任务依赖图正确（独立模块可并行）

批准计划。让 /harden 自动执行。

## 完成后运行 /verify

/verify

确保：
- npm run build 通过 (0 errors)
- npm test 通过 (所有 specification tests green)
- 6 个并行 review agents 全部通过：
  1. design-critic
  2. security-defender
  3. security-attacker
  4. ux-journeyer
  5. performance-reporter + accessibility-scanner
  6. spec-reviewer（验证实现匹配 experiment.yaml）
```

---

## Session 11: /deploy Assayer Platform

**Repo:** `assayer-io`
**Produces:** Deploy manifest + live site
**Prerequisite:** Session 10 PR merged

```
你是世界冠军级别的 DevOps 工程师。你的任务是将 Assayer 部署到 assayer.io。

## 前置：准备基础设施凭证

在运行 /deploy 之前，确保以下基础设施就绪：

### Vercel
- Vercel Pro 账户（支持自定义域名）
- 项目名：assayer-io
- GitHub 仓库已连接

### Supabase
- 新建 project（由 /deploy 处理）
- 或者已有 project URL + anon key + service key

### PostHog
- Project 已创建（共享 project for platform + experiments）
- NEXT_PUBLIC_POSTHOG_KEY 就绪
- POSTHOG_PERSONAL_API_KEY 就绪（metrics sync 用）

### OAuth Apps
- Google OAuth: https://console.cloud.google.com/apis/credentials
  - 创建 OAuth 2.0 Client ID
  - Authorized redirect URI: https://assayer.io/auth/callback, https://<supabase-project>.supabase.co/auth/v1/callback
- GitHub OAuth: https://github.com/settings/developers
  - 创建 OAuth App
  - Authorization callback URL: https://<supabase-project>.supabase.co/auth/v1/callback

### Domain
- assayer.io 域名已购买
- DNS 可配置（A record 或 CNAME 指向 Vercel）

### API Keys
- ANTHROPIC_API_KEY (Claude API for AI spec generation)
- ASSAYER_API_KEY (自生成: openssl rand -hex 32)

## 运行 /deploy

/deploy

## 部署计划审查清单

当 /deploy 呈现计划时，确认：

### 环境变量（完整列表）
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_POSTHOG_KEY
- NEXT_PUBLIC_POSTHOG_HOST
- POSTHOG_PERSONAL_API_KEY
- POSTHOG_PROJECT_ID
- ANTHROPIC_API_KEY
- ASSAYER_API_KEY
- GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
- GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET

### Database Migrations
- 所有 9 张表 + RLS policies + triggers
- updated_at triggers
- Indexes

### Domain
- assayer.io → Vercel
- SSL 自动（Let's Encrypt via Vercel）

批准部署计划。

## 部署后验证

1. 访问 https://assayer.io — 确认 landing page 加载
2. 测试 signup 流程（email + password）
3. 测试 Google OAuth login
4. 测试 GitHub OAuth login
5. 创建一个测试实验 — 验证 AI spec 生成功能
6. 访问 dashboard — 确认实验显示
7. 检查 PostHog — 确认事件被跟踪
8. 检查 /api/experiments — 确认 API 响应正确
9. 测试 rate limiting — 快速连续调用 /api/experiments/:id/spec 11 次，第 11 次应返回 429
```

---

## Session 12: First Real Experiment on Assayer

**Repo:** `assayer-io` (platform) + 新的实验 repo
**Produces:** 第一个实验 + 分发计划
**Prerequisite:** Session 11 complete (app deployed)

```
你是世界冠军级别的增长策略师。你的任务是用已部署的 Assayer 平台运行它自己的第一个验证实验。

## Step 1: 在 Assayer 平台创建实验

打开 https://assayer.io（如果本地开发用 http://localhost:3000）

1. 登录（用部署时创建的管理员账户）
2. 点击 "New Experiment"
3. 输入 idea：

"Indie hackers and startup founders waste weeks building MVPs before knowing if anyone wants their product. They code features nobody uses, run ads with no strategy, and make decisions based on gut feel instead of data. Assayer fixes this: describe your idea in 2 sentences, and AI generates a complete experiment — hypotheses with testable thresholds, a landing page with A/B variants, and a funnel scorecard that tells you whether to scale, refine, pivot, or kill. The scientific method for startups."

4. Type: web-app
5. Level: L1 Pitch
6. Click "Generate Spec"

## Step 2: 审查 + 调整 AI 输出

### 假设校准
确保生成的假设包含：
- REACH: "Ad CTR > 2% for 'validate startup idea' keywords"
  Threshold: > 2% CTR from 500+ impressions
- DEMAND: "Indie hackers will sign up for an AI validation tool"
  Threshold: > 5% signup rate from 500+ visitors
- MONETIZE: "Founders will explore paid plans for structured validation"
  Threshold: > 3% pricing page interaction rate

### Variant 校准
确保变体差异明显：
- "efficiency": "Validate Ideas 10x Faster Than Building"
- "data-driven": "Replace Gut Feel with Data-Driven Decisions"
- "risk": "Stop Wasting $10K on Ideas Nobody Wants"

编辑任何需要调整的内容。点击 "Create Experiment"。

## Step 3: 验证数据流

在 dashboard 确认实验显示且状态为 draft。
打开实验详情：
- Overview tab: 应显示 "No analysis yet"
- Hypotheses tab: 应显示所有假设（status: pending）
- Variants tab: 应显示所有变体
- Data tab: 应显示 "No metrics yet"
- Insights tab: 应显示 "No decisions yet"

## Step 4: 在单独 repo 中构建实验

在本地创建实验 repo：
mkdir -p ~/claude_projects/assayer-validation && cd ~/claude_projects/assayer-validation

复制模板到新 repo（和 Session 1 相同流程但更简洁）：
- 从 Assayer 平台导出 experiment.yaml（或从 AI 输出手动创建）
- 运行 /bootstrap → /verify → /deploy
- 部署到 assayer-validation.vercel.app（或 assayer-validation.assayer.io）

## Step 5: 分发策略

为实验准备分发计划（还不投放，先准备）：

### 渠道 1: Product Hunt
- 标题建议: "Assayer — The Scientific Method for Startup Ideas"
- 描述: 2-3 句话
- Maker comment 模板

### 渠道 2: Indie Hackers
- 帖子标题: "Show IH: I built an AI tool that generates experiment specs for startup ideas"
- 帖子要点: 问题 + 解决方案 + 邀请试用

### 渠道 3: Hacker News (Show HN)
- 标题: "Show HN: Assayer – AI-powered MVP validation for indie hackers"

### 渠道 4: Reddit r/startups + r/SideProject
- 帖子模板

### 渠道 5: Google Ads（付费）
- 关键词组: "validate startup idea", "mvp validation tool", "test business idea"
- 预算: $200, 7 天
- 运行 /distribute 生成详细广告文案

将分发计划保存到实验 repo 的 docs/distribution-plan.md。

## 成功标准
- [ ] Assayer 平台上有一个状态为 draft 的实验
- [ ] 实验包含 3+ 假设、3+ 变体
- [ ] 实验 landing page 已部署（独立 repo）
- [ ] 分发计划已准备就绪
- [ ] 准备进入 7 天数据收集期
```

---

## 附录: 并行执行指南

如果你有多个 Claude Code session 可同时运行：

| 阶段 | 并行 Session A | 并行 Session B |
|------|---------------|---------------|
| Phase 2 | Session 5 (CRUD) | Session 6 (Research+AI) |
| Phase 3 | Session 7 (New Experiment) | Session 8 (Dashboard) |

注意：并行 session 必须在不同分支上工作，合并时可能需要处理冲突。
Session 5 和 6 的分支基于 Session 4 的 main。
Session 7 和 8 的分支基于 Sessions 5+6 合并后的 main。

## 附录: 每个 Session 的预估时间

| Session | 复杂度 | 预估 PRs | 关键风险 |
|---------|-------|---------|---------|
| 0 | 高 | 3 | 3 PR 序列，每个依赖前一个 |
| 1 | 中 | 1 | /spec 交互性 |
| 2 | 低 | 0 (直接 commit) | 人工审查 |
| 3 | 高 | 1 | Bootstrap 大型应用 |
| 4 | 低 | 1 | 标准中间件 |
| 5 | 中 | 1 | CRUD + RLS + 状态机 |
| 6 | 高 | 1 | AI + PostHog 集成 |
| 7 | 高 | 1 | 复杂 UI + 交互 |
| 8 | 高 | 1 | 数据可视化 |
| 9 | 中 | 1 | 集成 + 设置 |
| 10 | 高 | 1 | 全面测试 |
| 11 | 中 | 0 (deploy) | 基础设施配置 |
| 12 | 低 | 1 (实验 repo) | 验证流程 |
