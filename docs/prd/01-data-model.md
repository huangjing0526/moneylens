# 01 数据模型与存储

## 数据库

- 使用 Turso（libsql / 兼容 SQLite）作为持久化存储
- 通过环境变量 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` 连接
- 单例模式初始化，首次调用 `getDb()` 时自动执行建表 + 种子数据

## 表结构

### transactions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| source | TEXT | 来源：alipay / wechat / bank / manual / ocr |
| source_id | TEXT | 原始平台交易号（用于同源去重） |
| date | TEXT | 日期 YYYY-MM-DD |
| time | TEXT | 时间 HH:MM:SS（可空） |
| amount | REAL | 金额（支出为负，收入为正） |
| type | TEXT | income / expense |
| description | TEXT | 交易描述/商品名 |
| counterparty | TEXT | 交易对方 |
| category_slug | TEXT | 关联分类 slug |
| payment_method | TEXT | 支付方式 |
| note | TEXT | 用户备注 |
| is_duplicate | INTEGER | 0=正常, 1=重复（软删除） |
| import_id | INTEGER | 关联导入批次 |
| created_at | DATETIME | 创建时间 |

**索引**：date、category_slug、source_id

### categories

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| slug | TEXT UNIQUE | 唯一标识（如 food、transport） |
| name | TEXT | 显示名称 |
| icon | TEXT | Lucide 图标名 |
| color | TEXT | HEX 颜色值 |
| sort_order | INTEGER | 排序权重 |
| is_income | INTEGER | 0=支出类, 1=收入类 |

### category_rules

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| keyword | TEXT | 匹配关键词 |
| category_slug | TEXT | 目标分类 |
| source | TEXT | default / user / learned |
| priority | INTEGER | 优先级（越大越优先） |

**索引**：keyword

### import_history

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| filename | TEXT | 原始文件名 |
| source | TEXT | 来源平台 |
| total_count | INTEGER | 总条数 |
| imported_count | INTEGER | 实际导入条数 |
| duplicate_count | INTEGER | 重复跳过条数 |
| created_at | DATETIME | 导入时间 |

## TypeScript 类型定义

文件位置：`src/types/index.ts`

- `Transaction` — 完整数据库行
- `TransactionInput` — 导入/创建时的输入 DTO
- `Category` — 分类
- `CategoryRule` — 分类规则
- `ImportHistory` — 导入历史
- `DuplicateCandidate` — 去重候选（新交易 + 已有交易 + 相似度分数）
- `MonthlyReport` — 月度汇总
- `RecurringExpense` — 周期性支出

## 种子数据

首次初始化时自动插入：

**18 个默认分类**：
- 支出（13）：餐饮 food、交通 transport、购物 shopping、娱乐 entertainment、住房 housing、医疗 medical、通信 telecom、教育 education、水电 utilities、订阅 subscription、信用卡 credit_card、转账 transfer、自转账 transfer_self
- 收入（4）：工资 salary、奖金 bonus、退款 refund、其他收入 income_other
- 特殊（1）：未分类 uncategorized

**110+ 条默认分类规则**：
- 覆盖美团、淘宝、京东、滴滴、12306 等主流平台关键词
- 每条规则带 priority 权重，用于冲突时优先匹配

## 统计排除规则

查询层面通过 `STATS_EXCLUDE_SQL` 排除：
- `credit_card`（信用卡还款）
- `transfer_self`（余额宝/理财等自转账）

这些交易会被记录和展示，但不计入收入/支出总额。
