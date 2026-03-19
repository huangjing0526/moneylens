# MoneyLens (钱迹) — 产品需求文档 (PRD)

> **版本**: v0.1.0
> **最后更新**: 2026-03-19
> **状态**: MVP 开发中

---

## 1. 产品概述

MoneyLens 是一款**隐私优先的个人财务管理工具**，帮助用户从多种数据源（支付宝、微信、银行账单、截图 OCR、手动录入）导入交易记录，自动分类、去重，并提供直观的可视化分析报表。

### 1.1 核心价值

- **一键导入**: 支持支付宝/微信/银行 CSV、Excel、截图 OCR 多格式导入
- **智能分类**: 基于规则 + 模糊匹配的自动分类引擎，111 条默认规则
- **跨源去重**: 同源精确去重 + 跨源模糊去重（Bigram 相似度算法）
- **可视化分析**: 热力图、趋势图、分类饼图、月度对比等多维度报表
- **隐私优先**: 数据存储在 Turso (SQLite Edge)，支持本地部署

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 前端 | React 19, TypeScript 5, Tailwind CSS 4 |
| UI 组件 | Shadcn UI (Base UI) |
| 图表 | Recharts |
| 数据库 | Turso (LibSQL/SQLite Edge) |
| CSV 解析 | Papa Parse |
| Excel 解析 | SheetJS (xlsx) |
| 编码处理 | iconv-lite (GBK fallback) |
| OCR | Anthropic Claude API (主) / Tesseract.js (备) |
| 测试 | Vitest |
| 部署 | Vercel |

---

## 2. 信息架构

```
MoneyLens
├── 首页仪表盘 (/)
├── 账单导入 (/import)
├── 账单列表 (/transactions)
├── 月度报表 (/reports)
├── 分类管理 (/categories)
├── 设置 (/settings)
└── 登录 (/login)
```

---

## 3. 功能模块

### 3.1 账单导入 (`/import`)

#### 3.1.1 文件格式支持

| 格式 | 来源 | 说明 |
|------|------|------|
| CSV (UTF-8/GBK) | 支付宝、微信、银行 | 自动检测编码，跳过 meta 行 |
| Excel (.xlsx/.xls) | 银行、记账工具 | 自动定位 header 行，支持 Excel 序列号日期 |
| 图片 (PNG/JPG) | 截图 | Claude API OCR 识别，Tesseract.js 兜底 |
| 手动录入 | 用户 | 快速记一笔面板 |

#### 3.1.2 解析流程

```
文件上传 → 编码检测(UTF-8/GBK) → 跳过meta行 → 格式识别(支付宝/微信/银行)
→ 列名匹配(标准+模糊+猜测) → 日期/金额/描述提取 → 自动分类 → 去重检测 → 预览确认 → 入库
```

#### 3.1.3 来源识别规则

- **支付宝**: 检测 `交易号`/`商家订单号`/`交易创建时间`/`交易金额`/`交易状态` 等特征列（≥2 列匹配）
- **微信**: 检测 `商品` + `交易对方` + `收/支` 或 `金额(元)` + `交易对方` 等特征组合
- **银行**: 以上均不匹配时，使用通用列名匹配（中/英文标准列名 + 模糊匹配 + 数据值猜测 fallback）

#### 3.1.4 通用列名匹配（银行格式）

| 字段 | 匹配模式 |
|------|----------|
| 日期 | `日期`, `交易日期`, `交易时间`, `记账日期`, `Date`, `Time` |
| 金额 | `金额`, `交易金额`, `收支金额`, `发生额`, `Amount`, `Money` |
| 描述 | `描述`, `摘要`, `说明`, `备注`, `用途`, `对方信息`, `Description` |
| 类型 | `收/支`, `收支`, `类型`, `交易类型`, `Type` |
| 对方 | `交易对方`, `对方户名`, `收款方`, `付款方`, `Counterparty` |

当标准列名匹配失败时，从第一行数据值猜测：日期格式 (`YYYY-MM-DD`) → 日期列；数字格式 (含 ¥/￥) → 金额列。

#### 3.1.5 日期格式支持

- `YYYY-MM-DD`, `YYYY/MM/DD`, `YYYY年MM月DD日`
- 单位数月日自动补零: `2024-1-5` → `2024-01-05`
- 日期+时间: `2024-01-15 14:30:00` → 分别存储 date 和 time
- Excel 序列号日期: 通过 `SSF.parse_date_code` 转换

#### 3.1.6 金额处理

- 去除 `¥`, `￥`, 逗号, 空格
- 支持负数 (`-50.00`)
- NaN 和零值跳过
- 收支类型判断: 有类型列按类型列；无类型列按金额正负

#### 3.1.7 处理阶段 UI

上传 → 解析中 → 分类中 → 完成（含进度条和耗时显示，支持取消）

### 3.2 去重检测 (`/api/deduplicate`)

#### 3.2.1 同源去重

- 基于 `source_id` 精确匹配
- 同一来源的相同交易号不重复导入

#### 3.2.2 跨源去重

- **算法**: Bigram 字符串相似度
- **匹配条件**: 金额差 ≤ ±0.01 且日期差 ≤ 1 天 且描述/对方相似度 ≥ 70%
- **用户操作**: 预览界面展示相似度分数，用户确认后标记为重复

### 3.3 自动分类引擎 (`src/lib/categories/engine.ts`)

#### 3.3.1 分类优先级

```
1. 数据库规则匹配 (priority 最高)
   ├── 用户自定义规则 (priority: 20)
   └── 默认规则 (priority: 15)
2. 模糊词表匹配 (内置词库)
   ├── 餐饮 (200+ 词: 饭/面/奶茶/火锅/美团外卖...)
   ├── 购物 (旗舰店/零食/服装/化妆品...)
   ├── 交通 (滴滴/共享单车/航班...)
   ├── 娱乐 (门票/景区/游戏...)
   ├── 医疗 (药店/医院...)
   ├── 订阅 (VIP/会员/API/SaaS...)
   └── 住房 (房东/自如/链家/物业...)
3. 启发式规则
   ├── 内部转账 (余额宝/理财/基金/网商银行转入 → transfer_self)
   ├── 对外转账 (空描述+人名对方 → transfer)
   └── 特殊商户匹配
```

#### 3.3.2 默认分类体系

**支出类 (14 类)**:
`food` 餐饮, `transport` 交通, `shopping` 购物, `entertainment` 娱乐, `housing` 住房, `medical` 医疗, `telecom` 通讯, `education` 教育, `utilities` 水电燃气, `subscription` 订阅服务, `credit_card` 信用卡还款, `transfer` 转账, `transfer_self` 内部转账, `uncategorized` 未分类

**收入类 (4 类)**:
`salary` 工资, `bonus` 奖金, `refund` 退款, `income_other` 其他收入

#### 3.3.3 默认规则数量

111 条关键词规则，优先级 3-10 不等。

### 3.4 首页仪表盘 (`/`)

| 组件 | 说明 |
|------|------|
| 费用热力图 | GitHub 风格，支持 1/3/6/12 月切换，点击显示日期和金额 |
| 月度汇总卡片 | 本月收入/支出，同比上月变化 |
| 分类分布 | 横向柱状图，排除 credit_card 和 transfer_self |
| 固定支出 | 自动检测月度重复支出（≥2 月出现，金额波动 ≤5%） |
| 6 月趋势 | 收入 vs 支出折线图 |

### 3.5 账单列表 (`/transactions`)

- **筛选**: 全部/本月/上月 时间段；按分类/关键词搜索
- **展示**: 按日期分组倒序，显示描述、对方、分类、金额
- **操作**: 行内快速改分类（5 列网格选择器）、悬浮删除
- **分页**: 每页 50 条

### 3.6 月度报表 (`/reports`)

- 月份导航（不超过当月）
- 汇总卡片: 支出/收入/结余
- 分类饼图 (Donut): Top 5 + 其他
- 分类排行: 横向柱状图 + 展开查看明细
- 排除项明细: 信用卡还款、内部转账单独显示
- 6 月对比柱状图

### 3.7 分类管理 (`/categories`)

- 支出/收入分 Tab 展示
- 新建分类: 名称 + 图标选择器 (24+ Lucide 图标) + 颜色选择器 (20 色)
- 编辑: 行内修改名称/图标/颜色
- 删除: 确认后将关联交易移入 `uncategorized`
- 保护: `uncategorized` 不可删除

### 3.8 快速记账 (`quick-add-panel`)

- 从侧边栏/底栏触发的模态面板
- 快速录入: 金额、描述、分类、日期
- 来源标记为 `manual`

### 3.9 认证 (`/login`, `middleware.ts`)

- **可选密码保护**: 设置 `APP_PASSWORD` 环境变量启用
- **会话机制**: Cookie (`moneylens_auth`) 存储密码
- **白名单**: `/login`, `/api/auth/login`, 静态资源不需认证
- **未设密码**: 无保护（本地开发模式）

---

## 4. 数据模型

### 4.1 数据库表结构

```sql
-- 分类
categories (id PK, slug UNIQUE, name, icon, color, sort_order, is_income)

-- 分类规则
category_rules (id PK, keyword, category_slug FK, source, priority)
  source IN ('default', 'user', 'learned')

-- 导入记录
import_history (id PK, filename, source, total_count, imported_count, duplicate_count, created_at)

-- 交易
transactions (id PK, source, source_id, date, time, amount, type, description,
  counterparty, category_slug FK, payment_method, note,
  is_duplicate, duplicate_of, import_id FK, created_at, updated_at)
  source IN ('alipay', 'wechat', 'bank', 'manual', 'ocr')
  type IN ('income', 'expense')
```

### 4.2 索引

- `idx_transactions_date` — 按日期查询/排序
- `idx_transactions_category` — 按分类筛选
- `idx_transactions_source_id` — 去重查询
- `idx_category_rules_keyword` — 分类匹配

---

## 5. API 接口

### 5.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 密码登录，设置 cookie |

### 5.2 交易

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/transactions` | 列表查询（日期/分类/搜索/类型/分页） |
| POST | `/api/transactions` | 批量插入 + 自动分类 |
| PATCH | `/api/transactions/[id]` | 更新分类/元数据 |
| DELETE | `/api/transactions/[id]` | 删除交易 |
| GET/POST | `/api/transactions/fix-all` | 批量数据修复 |
| POST | `/api/transactions/reclassify` | 批量重新分类 |

### 5.3 导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/csv` | CSV/Excel 解析 + 去重 + 分类 |
| POST | `/api/import/excel` | Excel 导入（含智能 header 检测） |
| POST | `/api/import/ocr` | 截图 OCR 识别（Claude API / Tesseract.js） |

### 5.4 分类

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取所有分类 |
| POST | `/api/categories` | 新建分类 |
| PATCH | `/api/categories/[slug]` | 更新分类 |
| DELETE | `/api/categories/[slug]` | 删除分类（交易归入 uncategorized） |
| POST | `/api/categories/migrate` | 批量迁移 |

### 5.5 报表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reports` | 月度汇总（收支/分类/日明细） |
| GET | `/api/reports?type=trend` | 6 月趋势 |
| GET | `/api/reports?type=heatmap` | 日支出热力图 |
| GET | `/api/reports/recurring` | 固定支出检测 |

### 5.6 去重

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/deduplicate` | 标记为重复 |

---

## 6. 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `TURSO_DATABASE_URL` | 是 | Turso 数据库连接地址 |
| `TURSO_AUTH_TOKEN` | 是 | Turso 认证 Token |
| `ANTHROPIC_API_KEY` | 否 | Claude API Key（OCR 功能，无则用 Tesseract.js） |
| `APP_PASSWORD` | 否 | 应用密码（不设则无保护） |

---

## 7. 测试覆盖

### 7.1 测试文件清单

| 文件 | 模块 | 用例数 |
|------|------|--------|
| `src/lib/parsers/tests/parser.test.ts` | 通用解析器 + Excel | 57 |
| `src/lib/parsers/tests/alipay.test.ts` | 支付宝解析器 | — |
| `src/lib/parsers/tests/wechat.test.ts` | 微信解析器 | — |
| `src/lib/parsers/__tests__/parser.test.ts` | 通用解析器 (旧) | — |
| `src/lib/parsers/__tests__/alipay.test.ts` | 支付宝解析器 (旧) | — |
| `src/lib/parsers/__tests__/wechat.test.ts` | 微信解析器 (旧) | — |
| `src/lib/categories/__tests__/engine.test.ts` | 分类引擎 | — |
| `src/lib/dedup/__tests__/dedup.test.ts` | 去重逻辑 | — |
| `src/lib/dedup/tests/dedup.test.ts` | 去重逻辑 | — |
| `src/lib/db/tests/queries.test.ts` | 数据库查询 | — |
| `src/lib/utils/__tests__/format.test.ts` | 格式化工具 | 33 |
| `src/lib/utils/__tests__/icons.test.ts` | 图标映射 | 6 |
| `src/lib/utils/__tests__/utils.test.ts` | 通用工具 | 10 |
| `src/middleware.test.ts` | 认证中间件 | — |
| `src/tests/security.test.ts` | 安全测试 | — |

### 7.2 通用解析器测试矩阵 (57 用例)

| 类别 | 用例数 | 覆盖点 |
|------|--------|--------|
| 编码检测 (decodeBuffer) | 2 | UTF-8 正常、GBK fallback |
| Meta 行跳过 (skipMetaLines) | 7 | meta 行、#/---/-/空行跳过、逗号阈值 |
| 来源识别 | 3 | 支付宝/微信/银行 |
| 列名匹配 | 8 | 中英文标准/备选列名、模糊匹配 |
| 列名猜测 fallback | 5 | 数据值猜测、¥ 符号、无法猜测 |
| 日期格式 | 7 | YYYY-MM-DD/斜杠/中文/补零/含时间/无效/部分 |
| 金额处理 | 7 | 正常/¥/￥/逗号/NaN/零/负数 |
| 收支类型 | 6 | 收入/已收入/income/正负推断/支出 |
| 描述 fallback | 3 | 描述列/对方/默认值 |
| Excel 解析 | 6 | 标准/meta 跳过/空文件/序列号日期/Date 对象/来源检测 |
| 边界场景 | 3 | 空 Buffer/仅 header/金额含空格 |

### 7.3 工具函数测试矩阵 (49 用例)

#### format.ts (33 用例)

| 类别 | 用例数 | 覆盖点 |
|------|--------|--------|
| formatCurrency | 10 | 正数、负数、零、负零、千分位、精度补零、极小值、极小负值、整数、四舍五入 |
| formatAmount | 9 | 小额、零、万元转换(≥10000)、边界 9999.99、大额、负数绝对值、负大额、toFixed 四舍五入 |
| getMonthRange | 7 | 31 天月、闰年 2 月(29)、非闰年 2 月(28)、30 天月、12 月、世纪闰年 2000、非闰百年 1900 |
| getCurrentYearMonth | 2 | YYYY-MM 格式匹配、与当前 Date 一致 |
| getPreviousYearMonth | 5 | 普通月、1 月跨年、补零、3→2 月、12→11 月 |

#### utils.ts — cn() (10 用例)

| 类别 | 用例数 | 覆盖点 |
|------|--------|--------|
| 基础合并 | 3 | 多类名拼接、空字符串、无参数 |
| 条件过滤 | 2 | false/undefined/null 过滤 |
| Tailwind 冲突解析 | 2 | 同属性覆盖 (p-2→p-4)、颜色覆盖 (text-red→text-blue) |
| 高级输入 | 3 | 数组输入、对象语法 {key:bool}、嵌套混合 |

#### icons.ts (6 用例)

| 类别 | 用例数 | 覆盖点 |
|------|--------|--------|
| getIcon | 3 | 已知图标返回对应组件、已知图标≠fallback、未知图标返回 CircleDashed |
| AVAILABLE_ICONS | 3 | 长度>0、包含已知 key、全量可解析验证 |

---

## 8. 项目结构

```
moneylens/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API 路由
│   │   │   ├── auth/login/           # 认证
│   │   │   ├── categories/           # 分类 CRUD
│   │   │   ├── deduplicate/          # 去重
│   │   │   ├── import/               # 导入 (csv/excel/ocr)
│   │   │   ├── reports/              # 报表 + 固定支出
│   │   │   └── transactions/         # 交易 CRUD + 重分类
│   │   ├── page.tsx                  # 仪表盘
│   │   ├── transactions/page.tsx     # 账单列表
│   │   ├── import/page.tsx           # 导入管理
│   │   ├── reports/page.tsx          # 月度报表
│   │   ├── categories/page.tsx       # 分类管理
│   │   ├── settings/page.tsx         # 设置
│   │   ├── login/page.tsx            # 登录页
│   │   └── layout.tsx                # 根布局 (侧边栏/底栏)
│   ├── components/
│   │   ├── charts/                   # 可视化图表
│   │   │   ├── heatmap.tsx           # 费用热力图
│   │   │   ├── category-bar.tsx      # 分类柱状图
│   │   │   ├── category-pie.tsx      # 分类饼图
│   │   │   ├── trend-line.tsx        # 趋势折线图
│   │   │   └── monthly-compare.tsx   # 月度对比
│   │   ├── import/                   # 导入组件
│   │   │   ├── file-upload.tsx       # 文件上传 (拖拽)
│   │   │   └── import-preview.tsx    # 导入预览 + 去重展示
│   │   ├── layout/                   # 布局组件
│   │   │   ├── sidebar.tsx           # 桌面侧边栏 (可折叠)
│   │   │   └── tab-bar.tsx           # 移动底部导航
│   │   ├── quick-add/                # 快速记账
│   │   └── ui/                       # Shadcn UI 组件库
│   ├── lib/
│   │   ├── db/                       # 数据层
│   │   │   ├── index.ts              # 数据库连接
│   │   │   ├── schema.ts             # 建表 DDL
│   │   │   ├── queries.ts            # 查询函数
│   │   │   └── seed.ts               # 种子数据 (18 分类 + 111 规则)
│   │   ├── parsers/                  # 解析器
│   │   │   ├── index.ts              # 主入口 (parseCSV/parseExcel)
│   │   │   ├── alipay.ts             # 支付宝解析
│   │   │   └── wechat.ts             # 微信解析
│   │   ├── categories/               # 分类引擎
│   │   │   └── engine.ts             # 规则匹配 + 模糊分类
│   │   ├── dedup/                    # 去重逻辑
│   │   │   └── index.ts              # 同源/跨源去重
│   │   └── utils/                    # 工具函数
│   │       ├── format.ts             # 货币格式化、日期范围
│   │       └── icons.ts              # 图标映射 (40+ Lucide)
│   ├── types/index.ts                # TypeScript 类型定义
│   └── middleware.ts                 # 认证中间件
├── package.json
├── vitest.config.ts
├── tsconfig.json
└── components.json                   # Shadcn 配置
```

---

## 9. 待开发功能 (Roadmap)

- [ ] 预算管理 — 按分类设置月度预算，超支提醒
- [ ] 数据导出 — CSV/Excel/PDF 导出
- [ ] 多账本 — 支持个人/家庭/旅行等多账本
- [ ] 标签系统 — 交易多标签，灵活分组
- [ ] 智能学习 — 根据用户修改自动学习分类规则 (`source: 'learned'`)
- [ ] 年度报表 — 年度收支总结、消费趋势
- [ ] PWA 支持 — 离线访问、添加到主屏幕
- [ ] 多语言 — i18n 国际化支持
