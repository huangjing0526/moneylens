# MoneyLens — 产品需求文档 (PRD)

> 版本：1.0.0
> 最后更新：2026-03-19
> 状态：已发布

---

## 1. 产品概述

### 1.1 产品定位

MoneyLens 是一款面向个人用户的智能记账与财务分析 Web 应用。核心价值在于**自动导入**支付宝、微信等平台的账单数据，通过**智能分类引擎**自动归类交易，并提供**可视化分析报表**，帮助用户洞察消费模式和财务健康状况。

### 1.2 目标用户

- 有记账需求但嫌手动记账繁琐的个人用户
- 使用支付宝、微信支付为主要支付方式的中国大陆用户
- 希望了解自身消费结构并优化支出的用户

### 1.3 核心价值主张

| 痛点 | MoneyLens 解决方案 |
|------|-------------------|
| 手动记账太累，难以坚持 | 一键导入支付宝/微信账单 CSV/Excel |
| 交易分类耗时 | 基于规则 + 模糊匹配的智能分类引擎，支持自动学习 |
| 多来源账单重复 | 跨来源去重（金额 ±0.01、日期 ±1天、描述相似度 ≥70%） |
| 不了解消费结构 | 月度报表、分类占比、消费热力图、趋势折线图 |
| 截图账单无法录入 | OCR 识别（Claude API / Tesseract.js） |

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选型 | 版本 |
|------|---------|------|
| 前端框架 | Next.js (App Router) | 16.1.6 |
| UI 框架 | React | 19.2.3 |
| 类型系统 | TypeScript | 5.x |
| 样式方案 | Tailwind CSS | 4.x |
| UI 组件库 | shadcn/ui + Lucide Icons | — |
| 图表库 | Recharts | 3.8.0 |
| 数据库 | SQLite (Turso / libsql) | — |
| CSV 解析 | PapaParse | 5.5.3 |
| Excel 解析 | xlsx (SheetJS) | 0.18.5 |
| OCR | Tesseract.js / Claude API | 7.0.0 |
| 编码转换 | iconv-lite | 0.7.2 |
| 测试框架 | Vitest | 4.1.0 |
| 部署平台 | Vercel（推荐） | — |

### 2.2 项目结构

```
src/
├── app/                          # Next.js App Router 页面与 API
│   ├── page.tsx                  # 首页仪表盘
│   ├── transactions/page.tsx     # 交易列表
│   ├── categories/page.tsx       # 分类管理
│   ├── import/page.tsx           # 导入页面
│   ├── reports/page.tsx          # 月度报表
│   ├── settings/page.tsx         # 设置
│   ├── login/page.tsx            # 登录
│   └── api/                      # REST API
│       ├── transactions/         # 交易 CRUD + 重分类 + 批量修复
│       ├── categories/           # 分类 CRUD + 迁移
│       ├── import/               # CSV / Excel / OCR 导入
│       ├── reports/              # 月度汇总 / 趋势 / 热力图 / 周期性消费
│       ├── deduplicate/          # 去重
│       └── auth/                 # 登录认证
├── components/                   # React 组件
│   ├── layout/                   # Sidebar, TabBar
│   ├── charts/                   # 饼图、柱状图、折线图、热力图、月度对比
│   ├── import/                   # 文件上传、导入预览
│   ├── quick-add/                # 快速记账面板
│   └── ui/                       # shadcn/ui 基础组件
├── lib/                          # 业务逻辑库
│   ├── db/                       # 数据库层（连接、Schema、查询、种子数据）
│   ├── parsers/                  # 账单解析（通用 / 支付宝 / 微信）
│   ├── categories/               # 智能分类引擎
│   ├── dedup/                    # 去重算法
│   └── utils/                    # 工具函数（格式化、图标映射）
├── types/                        # TypeScript 类型定义
├── middleware.ts                  # 认证中间件
└── tests/                        # 安全测试
```

### 2.3 数据库 Schema

```
┌─────────────────┐     ┌──────────────────────┐
│   categories    │     │   category_rules     │
├─────────────────┤     ├──────────────────────┤
│ id (PK)         │◄────│ category_slug (FK)   │
│ slug (UNIQUE)   │     │ id (PK)              │
│ name            │     │ keyword              │
│ icon            │     │ source               │
│ color           │     │ priority             │
│ sort_order      │     └──────────────────────┘
│ is_income       │
└────────┬────────┘
         │
         │ category_slug
┌────────┴────────────────┐     ┌──────────────────────┐
│     transactions        │     │   import_history     │
├─────────────────────────┤     ├──────────────────────┤
│ id (PK)                 │     │ id (PK)              │
│ source                  │────►│ filename             │
│ source_id               │     │ source               │
│ date (INDEX)            │     │ total_count          │
│ time                    │     │ imported_count       │
│ amount                  │     │ duplicate_count      │
│ type                    │     │ created_at           │
│ description             │     └──────────────────────┘
│ counterparty            │
│ category_slug (INDEX)   │
│ payment_method          │
│ note                    │
│ is_duplicate            │
│ duplicate_of            │
│ import_id (FK)          │
│ created_at              │
│ updated_at              │
└─────────────────────────┘
```

---

## 3. 功能模块

### 3.1 账单导入

#### 3.1.1 CSV 导入

| 项目 | 说明 |
|------|------|
| 支持格式 | 支付宝账单、微信账单、通用银行 CSV |
| 编码处理 | 自动检测 UTF-8 / GBK |
| 元数据跳过 | 自动跳过前 N 行非数据行（支付宝/微信账单头部信息） |
| 列检测 | 正则匹配日期、金额、描述、收支类型、交易对方等字段 |
| 日期格式 | 支持 YYYY-MM-DD、YYYY/MM/DD、YYYY年MM月DD日 |
| 金额处理 | 自动去除 ¥/￥ 符号和千分位逗号 |

#### 3.1.2 Excel 导入

| 项目 | 说明 |
|------|------|
| 支持格式 | .xlsx / .xls |
| 表头检测 | 在前 30 行中查找包含 ≥3 个已知关键词的行作为表头 |
| 日期转换 | 自动处理 Excel 日期序列号 → YYYY-MM-DD |
| 来源检测 | 同 CSV，自动判断支付宝/微信/通用格式 |

#### 3.1.3 OCR 截图导入

| 项目 | 说明 |
|------|------|
| 优先引擎 | Claude API（需配置 ANTHROPIC_API_KEY） |
| 降级引擎 | Tesseract.js（本地 OCR） |
| 支持内容 | 支付宝/微信交易截图 |

#### 3.1.4 去重机制

| 场景 | 匹配规则 |
|------|---------|
| 同来源 | source_id 完全匹配 |
| 跨来源 | 金额差 ≤ ¥0.01 **AND** 日期差 ≤ 1天 **AND** 描述/对方相似度 ≥ 70% |

### 3.2 智能分类

#### 3.2.1 分类引擎优先级

```
1. 精确关键词匹配（数据库 category_rules 表，按 priority 降序）
2. 模糊词匹配（内置常见词库：餐饮、购物、交通等）
3. 启发式检测（自转账、信用卡还款、退款）
4. 兜底 → uncategorized
```

#### 3.2.2 规则来源与优先级

| 来源 | priority | 说明 |
|------|----------|------|
| user | 20 | 用户手动添加的规则 |
| learned | 15 | 从用户修正中学习的规则 |
| default | 10 | 系统内置的默认规则 |

#### 3.2.3 预置分类（18 个）

**支出类：** 餐饮美食、购物消费、交通出行、居住租房、水电煤气、通讯网络、医疗健康、教育学习、娱乐休闲、运动健身、美容个护、宠物、人情往来、信用卡还款、内部转账、其他支出

**收入类：** 工资薪酬、其他收入

#### 3.2.4 自动学习

用户修改交易分类时，系统自动通过 `addCategoryRule` 创建 `source=learned` 的规则，后续相同关键词的交易自动归类。

### 3.3 交易管理

| 功能 | API | 说明 |
|------|-----|------|
| 列表查询 | `GET /api/transactions` | 支持日期范围、分类、收支类型、关键词搜索、分页 |
| 详情 | `GET /api/transactions/[id]` | 单条交易详情 |
| 新增 | `POST /api/transactions` | 手动添加交易 |
| 编辑 | `PATCH /api/transactions/[id]` | 修改分类/描述等，同时学习分类规则 |
| 删除 | `DELETE /api/transactions/[id]` | 删除单条交易 |
| 重分类 | `POST /api/transactions/reclassify` | 对所有交易重新运行分类引擎 |
| 批量修复 | `POST /api/transactions/fix-all` | 批量修复数据 |

**查询过滤器：**

| 参数 | 类型 | SQL 生成 |
|------|------|---------|
| — | 默认 | `WHERE is_duplicate = 0` |
| startDate | string | `AND date >= ?` |
| endDate | string | `AND date <= ?` |
| category | string | `AND category_slug = ?` |
| type | 'income' \| 'expense' | `AND type = ?` |
| search | string | `AND (description LIKE ? OR counterparty LIKE ?)` |
| limit | number | `LIMIT N` |
| offset | number | `OFFSET N` |

排序：`ORDER BY date DESC, time DESC`

所有查询参数均使用**参数化查询（?占位符）**，防止 SQL 注入。

### 3.4 分类管理

| 功能 | API | 说明 |
|------|-----|------|
| 列表 | `GET /api/categories` | 按 is_income → sort_order 排序 |
| 新增 | `POST /api/categories` | 创建新分类 |
| 编辑 | `PATCH /api/categories/[slug]` | 修改分类属性 |
| 删除 | `DELETE /api/categories/[slug]` | 删除分类 |
| 迁移 | `POST /api/categories/migrate` | 批量迁移交易分类 |

### 3.5 数据分析与报表

#### 3.5.1 仪表盘（首页）

- 当月收支汇总（totalIncome / totalExpense）
- 分类支出占比（饼图 + 横向柱状图）
- 每日消费热力图（365 天视图）
- 6 个月收支趋势折线图
- 周期性消费检测

#### 3.5.2 月度报表

| 指标 | 说明 |
|------|------|
| 月度收入 | `SUM(ABS(amount)) WHERE type='income'` |
| 月度支出 | `SUM(ABS(amount)) WHERE type='expense'` |
| 分类明细 | 按 category_slug 分组统计 |
| 每日支出 | 按 date 分组，`ORDER BY date` |
| 月度对比 | 与上月数据对比 |

**统计排除：** 信用卡还款（credit_card）和自转账（transfer_self）不计入收支统计，通过 `STATS_EXCLUDE_SQL` 常量实现：
```sql
category_slug NOT IN ('credit_card', 'transfer_self')
```

#### 3.5.3 趋势分析

- 最近 N 个月收支趋势（默认 6 个月）
- 每日支出热力图（指定日期范围）
- 周期性消费检测（月度固定支出识别）

### 3.6 认证与安全

#### 3.6.1 密码保护

| 项目 | 说明 |
|------|------|
| 机制 | 环境变量 `APP_PASSWORD` 设置密码 |
| 会话 | Cookie `moneylens_auth`，值为明文密码 |
| 无密码 | `APP_PASSWORD` 未设置或空字符串 → 跳过认证 |
| 白名单 | `/login`、`/api/auth/login`、`/_next/*`、`/icon*`、`/favicon.ico` |

#### 3.6.2 安全措施

| 安全项 | 实现方式 |
|--------|---------|
| SQL 注入防护 | 所有查询使用参数化 `?` 占位符 |
| 路径遍历防护 | 中间件使用 `===` 精确匹配和 `startsWith` 前缀匹配 |
| Cookie 比较 | 严格等号 `===`，不使用 includes/match |
| XSS 防护 | 前端负责转义，后端原样存储 |

---

## 4. 页面与交互

### 4.1 页面路由

| 路径 | 页面 | 功能 |
|------|------|------|
| `/` | 仪表盘 | 月度概览、分类占比、热力图、趋势图 |
| `/transactions` | 交易列表 | 筛选、搜索、内联编辑分类、删除 |
| `/import` | 导入 | 文件拖放上传、预览确认、去重冲突处理 |
| `/categories` | 分类管理 | 分类 CRUD、图标颜色选择 |
| `/reports` | 月度报表 | 饼图、分类排名、交易明细展开、月度对比 |
| `/settings` | 设置 | API Key 配置、数据库信息、版本号 |
| `/login` | 登录 | 密码输入 |

### 4.2 响应式设计

- **桌面端：** 左侧 Sidebar 导航
- **移动端：** 底部 TabBar 导航
- UI 组件基于 shadcn/ui，Tailwind CSS 实现响应式布局

---

## 5. 测试策略

### 5.1 测试框架

Vitest 4.1.0，Node 环境，全局 API 启用，路径别名 `@/` → `./src/`。

### 5.2 测试覆盖

**总用例数：291 个**

| 模块 | 测试文件 | 用例数 | 覆盖内容 |
|------|---------|--------|---------|
| 数据库查询层 | `src/lib/db/tests/queries.test.ts` | 31 | getTransactions 过滤器（12）、getTransactionById（2）、insertTransactions（3）、updateTransaction（3）、deleteTransaction（1）、getTransactionCount（3）、getMonthlySummary（4）、addCategoryRule（2）、STATS_EXCLUDE_SQL（1） |
| 安全测试 | `src/tests/security.test.ts` | 10 | SQL 注入防护（3）、中间件安全（4）、输入验证/Parser（3） |
| 支付宝解析 | `src/lib/parsers/tests/alipay.test.ts` | 35 | isAlipayCSV 格式检测（10）：多 header 命中/不足/备选条件/tab 空格清洗/空/无关/微信误判；parseAlipayCSV 解析（25）：收支类型判定、3 种退款路径（状态/交易分类/描述）、跳过条件（关闭/零额/NaN/无日期）、金额符号清洗（¥/￥/逗号）、日期格式转换、备选列名 fallback（付款时间/金额元/商品名称/交易订单号）、source_id/note/payment_method 默认值、多行解析、tab 列名容错 |
| 微信解析 | `src/lib/parsers/tests/wechat.test.ts` | 23 | isWechatCSV 格式检测（6）：3 种匹配条件/tab 空格/空/不匹配；parseWechatCSV 解析（17）：收支类型判定、退款处理（已退款/部分退款）、收/支为"/"或空的跳过与退款豁免、跳过条件（零额/NaN/无日期）、金额符号清洗、日期格式转换、source_id/支付方式默认值、描述 fallback 到交易类型、多行解析、tab 列名容错 |
| 通用解析 | `src/lib/parsers/__tests__/parser.test.ts` | 15 | 来源检测（3）、元数据行跳过（1）、通用 CSV 解析：日期格式/货币符号/零金额/无效日期/日期补零/时间提取/列猜测（8）、边界：空CSV/仅表头/金额含逗号（3） |
| 去重算法 | `src/lib/dedup/tests/dedup.test.ts` | 31 | stringSimilarity：相同/大小写/空值/单双字符/重叠/对称/中文/无交集/重复字符（15）、checkSameSourceDuplicate：null/undefined/空字符串跳过DB/DB有无匹配/SQL参数验证（6）、findCrossSourceDuplicates：高低相似度/空输入/counterparty/多条匹配/绝对值/70&69分边界（10） |
| 分类引擎 | `src/lib/categories/__tests__/engine.test.ts` | 75 | 规则缓存（3）、DB规则匹配：优先级/大小写/对方匹配（6）、模糊分类：住房(4)/订阅(6)/医疗(5)/购物CP(3)/购物关键词(8)/餐饮CP(5)/餐饮关键词(6)/交通(3)/娱乐(3)/无匹配(1)（44）、启发式回退：自转账(9)/转账(4)/收入(1)/购物(3)/餐饮(1)（23）、批量分类（4）、优先级冲突（6） |
| 工具函数 | `src/lib/utils/__tests__/utils.test.ts` | 10 | cn 类名合并：基础合并/falsy过滤/Tailwind冲突解决/数组输入/对象语法/嵌套（10） |
| 格式化工具 | `src/lib/utils/__tests__/format.test.ts` | 38 | formatCurrency 货币格式化（10）、formatAmount 金额缩写万（8）、getMonthRange 含闰年（7）、getCurrentYearMonth（2）、getPreviousYearMonth 含跨年（5） |
| 图标工具 | `src/lib/utils/__tests__/icons.test.ts` | 7 | getIcon 查找与回退（3）、AVAILABLE_ICONS 列表验证（4） |
| 认证中间件 | `src/middleware.test.ts` | 16 | 无密码放行（1）、Cookie 正确/错误/缺失（3）、公开路径：/login、/api/auth/login、/_next/*、/icon*、/favicon.ico（6）、受保护路径：/、/reports、/api/*（4）、/login/extra 不放行（1）、redirect URL 验证（1） |

### 5.3 测试策略要点

- **数据库层：** Mock `getDb` 返回的 execute/batch 方法，验证生成的 SQL 和参数
- **安全测试：** 验证参数化查询防注入、中间件源码静态分析、Parser 边界输入
- **解析器：** 使用真实格式的 CSV 数据构造 Buffer 进行端到端测试；支付宝/微信解析器通过隔离退款三条独立分支（状态/交易分类/描述）确保真实路径覆盖，行覆盖率 100%、分支覆盖率 ≥87%

---

## 6. 环境变量

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `TURSO_DATABASE_URL` | 是 | Turso 数据库连接 URL |
| `TURSO_AUTH_TOKEN` | 否 | Turso 认证令牌 |
| `APP_PASSWORD` | 否 | 应用访问密码，空 = 不启用认证 |
| `ANTHROPIC_API_KEY` | 否 | Claude API Key，用于 OCR 功能 |

---

## 7. 部署

| 项目 | 说明 |
|------|------|
| 推荐平台 | Vercel |
| 构建命令 | `npm run build` |
| 启动命令 | `npm start` |
| Node 版本 | ≥ 18 |
| 数据库 | Turso 托管 SQLite（需配置 URL + Token） |

---

## 8. 已知限制与改进方向

### 8.1 当前限制

| 项目 | 说明 |
|------|------|
| 认证安全 | Cookie 存储明文密码，无 CSRF 防护，无会话过期机制 |
| 空密码行为 | `APP_PASSWORD=''` 等同于未设置密码（空字符串为 falsy） |
| OCR 精度 | Tesseract.js 对中文识别精度有限，Claude API 更佳但需付费 |
| 数据导出 | 暂不支持数据导出功能 |
| 多用户 | 单用户设计，无多用户/多账本支持 |
| 预算管理 | 无预算设置与超支提醒功能 |

### 8.2 改进方向

- [ ] Session Token 替代明文密码 Cookie
- [ ] 添加 CSRF 防护
- [ ] 数据导出（CSV / Excel / PDF）
- [ ] 预算管理与超支提醒
- [ ] 多账本支持
- [ ] 银行 API 直连导入
- [ ] PWA 支持（离线访问）
- [ ] 更多银行 CSV 模板适配
