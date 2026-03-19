# MoneyLens 待开发功能 — 开发计划

> **制定日期**: 2026-03-20
> **基于版本**: v0.1.0 (MVP)

---

## 开发阶段总览

```
Phase 1 (基础增强)     ██████░░░░  智能学习 + 数据导出
Phase 2 (分析升级)     ████░░░░░░  年度报表 + 预算管理
Phase 3 (数据模型扩展) ████████░░  标签系统 + 多账本
Phase 4 (平台化)       ██████░░░░  PWA 支持 + 多语言
```

排序原则：**低风险高价值优先、数据模型变更后置、平台化能力最后**

---

## Phase 1: 基础增强

### Feature 1: 智能学习 (Smart Rule Learning)

**优先级**: P0 — 直接提升核心体验，零 schema 变更

**背景**: 用户在交易列表修改分类时，系统应自动学习并生成 `source: 'learned'` 规则，减少重复手动分类。

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/app/api/transactions/[id]/route.ts` | 修改 | PATCH 时触发学习逻辑 |
| `src/lib/categories/learner.ts` | 新建 | 学习引擎核心 |
| `src/lib/db/queries.ts` | 修改 | 新增 upsert rule 查询 |
| `src/lib/categories/engine.ts` | 修改 | clearRulesCache 联动 |
| `src/lib/categories/__tests__/learner.test.ts` | 新建 | 测试用例 |

**实现方案**:

```
用户修改分类
  → 提取 description / counterparty 关键词
  → 检查是否已有相同 keyword 的 learned 规则
    → 有: 更新 category_slug + priority++
    → 无: 插入新规则 (source='learned', priority=25)
  → 清除分类缓存
```

**关键设计决策**:
1. **关键词提取策略**: 优先用 counterparty（交易对方），其次用 description 中最长的非通用词
2. **优先级**: learned 规则 priority=25，高于 default(15) 和 user(20)，确保学习结果优先
3. **冲突处理**: 同一关键词如果用户改了多次分类，以最后一次为准
4. **最小修改次数**: 同一关键词被修改 ≥2 次才生成规则（避免误操作）

**测试要点** (8 cases):
- 首次修改不生成规则
- 同一关键词第 2 次修改生成 learned 规则
- learned 规则优先级高于 default
- 关键词冲突时覆盖旧规则
- 清除缓存后新规则生效
- counterparty 优先于 description 作为关键词
- 空 description + 空 counterparty 不生成规则
- 批量重分类触发学习

---

### Feature 2: 数据导出 (Data Export)

**优先级**: P0 — 用户强需求，实现简单

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/app/api/export/route.ts` | 新建 | 导出 API (CSV/Excel) |
| `src/app/api/export/pdf/route.ts` | 新建 | PDF 报表导出 |
| `src/components/export/export-button.tsx` | 新建 | 导出按钮组件 |
| `src/app/transactions/page.tsx` | 修改 | 集成导出按钮 |
| `src/app/reports/page.tsx` | 修改 | 集成报表导出 |

**实现方案**:

```
导出类型:
  1. CSV — 纯文本, Papa Parse unparse
  2. Excel — SheetJS 生成 .xlsx (已有依赖)
  3. PDF — 月度/年度报表 (使用 @react-pdf/renderer 或服务端 HTML→PDF)
```

**API 设计**:
```
GET /api/export?format=csv&startDate=2024-01&endDate=2024-12&category=food
GET /api/export?format=xlsx&startDate=2024-01&endDate=2024-12
GET /api/export/pdf?month=2024-06  (月度报表)
```

**关键设计决策**:
1. **CSV**: 使用 Papa Parse `unparse()`，复用已有依赖
2. **Excel**: 使用 SheetJS `XLSX.utils.json_to_sheet()`，复用已有依赖
3. **PDF**: 新增 `@react-pdf/renderer` 依赖，服务端渲染
4. **流式下载**: 大数据量使用 ReadableStream，设置 `Content-Disposition` header
5. **筛选继承**: 导出时继承当前页面筛选条件（日期范围、分类、关键词）

**导出字段**:
```
日期 | 时间 | 类型 | 金额 | 分类 | 描述 | 交易对方 | 支付方式 | 来源 | 备注
```

**测试要点** (6 cases):
- CSV 格式正确，中文不乱码 (BOM header)
- Excel 生成可被 Excel/WPS 打开
- 日期范围筛选生效
- 分类筛选生效
- 空结果返回仅含表头的文件
- PDF 包含正确的汇总数据

---

## Phase 2: 分析升级

### Feature 3: 年度报表 (Annual Reports)

**优先级**: P1 — 扩展已有报表模块

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/app/reports/page.tsx` | 修改 | 新增年度 Tab |
| `src/app/api/reports/route.ts` | 修改 | 新增 type=annual 查询 |
| `src/lib/db/queries.ts` | 修改 | 年度聚合查询 |
| `src/components/charts/annual-summary.tsx` | 新建 | 年度总结卡片 |
| `src/components/charts/monthly-compare.tsx` | 修改 | 支持 12 月全景对比 |

**实现方案**:

```
报表页 Tabs: [月度报表] [年度报表]

年度报表内容:
  ├── 年度总览卡片 (总收入/总支出/净收入/日均支出)
  ├── 12 月趋势对比柱状图 (复用 monthly-compare)
  ├── 年度 Top 10 分类饼图 (复用 category-pie)
  ├── 月均消费 vs 实际消费偏差图
  └── 同比分析 (今年 vs 去年, 如有数据)
```

**API 扩展**:
```
GET /api/reports?type=annual&year=2025
Response: {
  year, totalIncome, totalExpense, netIncome,
  monthlyBreakdown: [...12 months],
  categoryBreakdown: [...top categories],
  previousYear?: { totalIncome, totalExpense }  // 同比
}
```

**SQL 查询核心**:
```sql
-- 年度按月汇总
SELECT strftime('%m', date) as month,
       SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense,
       SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income
FROM transactions
WHERE strftime('%Y', date) = ?
GROUP BY month ORDER BY month;

-- 年度按分类汇总
SELECT category_slug, SUM(amount) as total
FROM transactions
WHERE type='expense' AND strftime('%Y', date) = ?
GROUP BY category_slug ORDER BY total DESC LIMIT 10;
```

**测试要点** (5 cases):
- 12 月数据完整聚合
- 空月份补零
- 同比计算正确 (有去年数据 / 无去年数据)
- Top 10 分类排序正确
- 年度切换器工作正常

---

### Feature 4: 预算管理 (Budget Management)

**优先级**: P1 — 需要新表 + 新页面，但逻辑独立

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/lib/db/schema.ts` | 修改 | 新增 budgets 表 |
| `src/lib/db/index.ts` | 修改 | initSchema 新增表 |
| `src/lib/db/queries.ts` | 修改 | 预算 CRUD + 超支查询 |
| `src/app/api/budgets/route.ts` | 新建 | 预算 API (GET/POST) |
| `src/app/api/budgets/[id]/route.ts` | 新建 | 预算 API (PATCH/DELETE) |
| `src/app/api/budgets/status/route.ts` | 新建 | 预算执行状态 |
| `src/components/budget/budget-card.tsx` | 新建 | 预算进度卡片 |
| `src/components/budget/budget-form.tsx` | 新建 | 预算设置表单 |
| `src/app/page.tsx` | 修改 | 仪表盘集成预算概览 |
| `src/app/settings/page.tsx` 或新页面 | 修改 | 预算管理入口 |

**Schema 设计**:
```sql
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_slug TEXT NOT NULL,           -- 'all' 表示总预算
  amount REAL NOT NULL,                  -- 月度预算金额
  year_month TEXT NOT NULL,              -- '2025-06' 或 'recurring'
  alert_threshold REAL DEFAULT 0.8,      -- 80% 预警阈值
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(category_slug, year_month)
);
```

**实现方案**:

```
预算类型:
  1. 总预算 (category_slug='all') — 月度总支出上限
  2. 分类预算 — 按分类设置各自上限
  3. 循环预算 (year_month='recurring') — 每月自动继承

预算状态查询:
  → 查询当月实际支出 (复用已有 monthly summary 查询)
  → 计算 spent / budget 比例
  → 返回 { budget, spent, remaining, percentage, isOverBudget, isWarning }

仪表盘集成:
  → 预算卡片展示 top 3 快超支分类
  → 进度条: 绿 (<80%) → 黄 (80-100%) → 红 (>100%)
```

**API 设计**:
```
GET    /api/budgets              — 列出所有预算
POST   /api/budgets              — 创建/更新预算
PATCH  /api/budgets/:id          — 修改预算
DELETE /api/budgets/:id          — 删除预算
GET    /api/budgets/status?month=2025-06  — 当月预算执行状态
```

**测试要点** (8 cases):
- 创建总预算和分类预算
- 循环预算自动继承到新月份
- 预算状态计算 (未超支/预警/超支)
- 修改预算后状态更新
- 删除分类时对应预算处理
- 同一分类同一月份不可重复创建
- 超支阈值自定义
- 无预算时仪表盘不显示预算卡片

---

## Phase 3: 数据模型扩展

### Feature 5: 标签系统 (Tag System)

**优先级**: P2 — 需要新表 + 多对多关系 + UI 改造

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/lib/db/schema.ts` | 修改 | 新增 tags + transaction_tags 表 |
| `src/lib/db/index.ts` | 修改 | initSchema |
| `src/lib/db/queries.ts` | 修改 | 标签 CRUD + 关联查询 |
| `src/types/index.ts` | 修改 | Tag, TransactionWithTags 类型 |
| `src/app/api/tags/route.ts` | 新建 | 标签 API |
| `src/app/api/transactions/[id]/route.ts` | 修改 | 支持标签更新 |
| `src/components/tags/tag-input.tsx` | 新建 | 标签输入组件 (多选+创建) |
| `src/components/tags/tag-badge.tsx` | 新建 | 标签展示组件 |
| `src/app/transactions/page.tsx` | 修改 | 集成标签筛选+展示 |

**Schema 设计**:
```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  transaction_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, tag_id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**实现方案**:

```
标签 vs 分类:
  - 分类: 一对一, 互斥, 系统预设 → 财务分析维度
  - 标签: 多对多, 自由创建 → 用户自定义分组维度

使用场景:
  - "旅行" 标签 → 标记一次旅行的所有消费 (跨分类)
  - "可报销" 标签 → 标记可报销项目
  - "共享消费" 标签 → AA 制消费

标签输入组件:
  - Combobox 风格，输入即搜索
  - 回车创建新标签
  - 点击已有标签快速添加
  - 拖拽排序 (可选)
```

**API 设计**:
```
GET    /api/tags                — 列出所有标签 (含使用次数)
POST   /api/tags                — 创建标签
DELETE /api/tags/:id            — 删除标签 (级联删除关联)
PATCH  /api/transactions/:id    — body 增加 tags: number[] 字段

GET    /api/transactions?tag=旅行  — 按标签筛选
```

**测试要点** (7 cases):
- 创建标签
- 交易关联多个标签
- 删除标签级联清理关联
- 按标签筛选交易
- 标签名唯一约束
- 标签使用次数统计
- 删除交易级联清理标签关联

---

### Feature 6: 多账本 (Multiple Ledgers)

**优先级**: P2 — 影响面最大，需要全局数据隔离

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/lib/db/schema.ts` | 修改 | 新增 ledgers 表, transactions 加 ledger_id |
| `src/lib/db/index.ts` | 修改 | initSchema + 默认账本 seed |
| `src/lib/db/queries.ts` | 修改 | 所有查询加 ledger_id 条件 |
| `src/types/index.ts` | 修改 | Ledger 类型 |
| `src/app/api/ledgers/route.ts` | 新建 | 账本 CRUD |
| `src/components/layout/ledger-switcher.tsx` | 新建 | 账本切换器 |
| `src/app/layout.tsx` | 修改 | 集成账本上下文 |
| `src/app/api/transactions/route.ts` | 修改 | 查询加 ledger 过滤 |
| `src/app/api/reports/route.ts` | 修改 | 报表加 ledger 过滤 |
| `src/app/api/import/*.ts` | 修改 | 导入指定账本 |

**Schema 设计**:
```sql
CREATE TABLE IF NOT EXISTS ledgers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📒',
  description TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- transactions 表新增字段
ALTER TABLE transactions ADD COLUMN ledger_id INTEGER DEFAULT 1
  REFERENCES ledgers(id);
CREATE INDEX idx_transactions_ledger ON transactions(ledger_id);
```

**实现方案**:

```
数据隔离策略:
  - 每个查询加 WHERE ledger_id = ?
  - 使用 React Context 存储当前账本 ID
  - URL 不含 ledger_id (通过 cookie/header 传递，减少 URL 侵入)

账本切换:
  - Sidebar 顶部下拉选择器
  - 切换后刷新当前页面数据

迁移策略:
  1. 创建 ledgers 表
  2. 插入默认账本 (id=1, name='默认账本', is_default=1)
  3. ALTER TABLE transactions ADD COLUMN ledger_id DEFAULT 1
  4. 现有数据自动归入默认账本
```

**关键设计决策**:
1. **分类是否账本隔离**: 否 — 分类全局共享，减少维护成本
2. **预算是否账本隔离**: 是 — budgets 表也加 ledger_id
3. **标签是否账本隔离**: 否 — 标签全局共享
4. **账本间转账**: 暂不支持，v2 考虑

**测试要点** (8 cases):
- 创建新账本
- 切换账本后数据隔离
- 默认账本不可删除
- 导入时指定账本
- 报表按账本过滤
- 删除账本处理 (迁移交易到默认账本)
- 预算按账本隔离
- 现有数据迁移到默认账本

---

## Phase 4: 平台化

### Feature 7: PWA 支持 (Progressive Web App)

**优先级**: P3 — 纯前端工程，不影响业务逻辑

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `public/manifest.json` | 新建 | PWA manifest |
| `public/sw.js` 或使用 next-pwa | 新建 | Service Worker |
| `src/app/layout.tsx` | 修改 | 引用 manifest, meta tags |
| `public/icons/` | 新建 | 各尺寸 App 图标 (192/512px) |
| `next.config.ts` | 修改 | PWA 插件配置 |

**实现方案**:

```
依赖选择: @ducanh2912/next-pwa (Next.js 14+ 兼容, 替代已停维护的 next-pwa)

manifest.json:
  - name: "MoneyLens 钱迹"
  - short_name: "钱迹"
  - theme_color: "#10b981" (emerald-500)
  - display: "standalone"
  - start_url: "/"

Service Worker 缓存策略:
  - App Shell (HTML/CSS/JS): CacheFirst
  - API 数据: NetworkFirst (失败回退缓存)
  - 图片/字体: CacheFirst, 30 天过期
  - 导入/导出 API: NetworkOnly (不缓存)

离线功能范围:
  ✅ 浏览已加载的仪表盘和交易列表
  ✅ 查看已加载的报表
  ❌ 新导入 (需要服务端解析+存储)
  ❌ 修改数据 (需要服务端同步)
```

**关键设计决策**:
1. **离线写入**: 暂不支持，MVP 仅离线读取已缓存数据
2. **更新提示**: SW 更新时 Toast 提示用户刷新
3. **图标**: 使用 MoneyLens logo 生成多尺寸 icons

**测试要点** (4 cases):
- manifest.json 格式校验
- 可安装到主屏幕 (Lighthouse PWA audit)
- 离线时已缓存页面可访问
- SW 更新后提示刷新

---

### Feature 8: 多语言 (i18n Internationalization)

**优先级**: P3 — 工作量大，全局文案替换

**涉及文件**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/lib/i18n/` | 新建 | i18n 配置 + 语言文件 |
| `src/lib/i18n/locales/zh-CN.json` | 新建 | 中文语言包 |
| `src/lib/i18n/locales/en.json` | 新建 | 英文语言包 |
| `src/lib/i18n/context.tsx` | 新建 | I18n React Context |
| `src/lib/i18n/useTranslation.ts` | 新建 | Hook |
| `src/app/layout.tsx` | 修改 | 包裹 I18nProvider |
| `src/app/settings/page.tsx` | 修改 | 语言切换选项 |
| `src/app/**/*.tsx` (所有页面) | 修改 | 文案替换为 t('key') |
| `src/components/**/*.tsx` | 修改 | 文案替换 |

**实现方案**:

```
方案选择: 轻量级自建 (不用 next-intl/react-i18next)
  - 原因: 应用规模小, 无 SEO 需求, 避免引入路由层改动

架构:
  I18nContext
    ├── locale: 'zh-CN' | 'en'
    ├── t(key: string, params?: Record): string
    └── setLocale(locale): void

  存储: localStorage('moneylens_locale'), 默认 'zh-CN'

语言包结构:
  {
    "nav.dashboard": "仪表盘",
    "nav.transactions": "账单列表",
    "import.title": "导入账单",
    "import.upload_hint": "拖拽或点击上传 CSV/Excel/截图",
    "report.monthly": "月度报表",
    "report.annual": "年度报表",
    "budget.over_budget": "已超支 {amount}",
    ...
  }
```

**工作量评估**:
- 语言包 key 提取: ~200-300 个 key
- 页面/组件改造: 8 个页面 + ~20 个组件
- 分类名称: categories seed 需要双语

**关键设计决策**:
1. **路由策略**: 不使用 `/en/`, `/zh/` 路径前缀 — 用 Context 切换，无 SEO 需求
2. **分类名称**: categories 表增加 `name_en` 字段，或语言包中维护映射
3. **日期/货币格式**: 跟随 locale (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
4. **服务端文案**: API 返回的 error message 保持英文，前端按 code 映射

**测试要点** (5 cases):
- 默认中文加载正确
- 切换英文后所有文案变更
- 带参数的翻译 (`{amount}`) 正确替换
- localStorage 持久化语言选择
- 缺失 key 回退到 key 本身 (不报错)

---

## 依赖关系图

```
Phase 1                Phase 2              Phase 3              Phase 4
┌──────────┐      ┌──────────┐       ┌──────────┐       ┌──────────┐
│ 智能学习  │      │ 年度报表  │       │ 标签系统  │       │ PWA 支持  │
│ (无依赖)  │      │ (无依赖)  │       │ (无依赖)  │       │ (无依赖)  │
└──────────┘      └──────────┘       └──────────┘       └──────────┘
┌──────────┐      ┌──────────┐       ┌──────────┐       ┌──────────┐
│ 数据导出  │      │ 预算管理  │──────→│ 多账本    │       │ 多语言    │
│ (无依赖)  │      │ (新表)    │ 需要  │(全局改造) │       │(全局改造) │
└──────────┘      └──────────┘ 考虑  └──────────┘       └──────────┘
                                隔离
```

**Phase 内部可并行开发**，Phase 间建议顺序执行。

---

## 数据库迁移计划

| Phase | 迁移内容 | 风险等级 |
|-------|----------|----------|
| Phase 1 | 无 schema 变更 | 🟢 零风险 |
| Phase 2 | 新增 `budgets` 表 | 🟢 低风险 (纯新增) |
| Phase 3 | 新增 `tags` + `transaction_tags` 表 | 🟢 低风险 (纯新增) |
| Phase 3 | `transactions` 加 `ledger_id` 列 + `ledgers` 表 | 🟡 中风险 (ALTER TABLE + 全局查询改造) |
| Phase 4 | `categories` 加 `name_en` 列 (可选) | 🟢 低风险 |

**迁移策略**: 在 `initSchema()` 中使用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` with try-catch (SQLite 不支持 `IF NOT EXISTS` for ALTER)。

---

## 新增依赖

| 功能 | 依赖包 | 用途 |
|------|--------|------|
| 数据导出 (PDF) | `@react-pdf/renderer` | PDF 生成 |
| PWA | `@ducanh2912/next-pwa` | Service Worker + 缓存 |

**原则**: 尽量复用已有依赖 (Papa Parse, SheetJS, Recharts)，最小化新增。

---

## 测试计划总览

| 功能 | 新增测试文件 | 用例数 |
|------|-------------|--------|
| 智能学习 | `categories/__tests__/learner.test.ts` | 8 |
| 数据导出 | `export/tests/export.test.ts` | 6 |
| 年度报表 | `db/tests/annual-queries.test.ts` | 5 |
| 预算管理 | `budget/tests/budget.test.ts` | 8 |
| 标签系统 | `tags/tests/tags.test.ts` | 7 |
| 多账本 | `db/tests/ledger.test.ts` | 8 |
| PWA | Lighthouse audit (手动) | 4 |
| 多语言 | `i18n/tests/i18n.test.ts` | 5 |
| **合计** | **8 个测试文件** | **51 cases** |

---

## 开发顺序建议

```
1. 智能学习    ← 零改动成本, 立即提升用户体验
2. 数据导出    ← 复用已有依赖, 实现简单
3. 年度报表    ← 扩展已有报表, 复用图表组件
4. 预算管理    ← 独立新功能, 新表无风险
5. 标签系统    ← 新表, 多对多关系
6. 多账本      ← 全局影响, 需要充分测试
7. PWA 支持    ← 纯前端, 独立开发
8. 多语言      ← 工作量最大, 全局文案替换
```

> 注: 7 和 8 之间无依赖，可调换或并行。
