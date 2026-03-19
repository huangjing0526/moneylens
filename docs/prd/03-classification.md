# 03 自动分类引擎

## 功能概述

对导入的交易记录进行自动分类，采用三级优先级递降的分类流水线。支持规则缓存和用户纠正自学习。

## 核心文件

`src/lib/categories/engine.ts`

## 分类流水线

### Step 1：DB 关键词规则（最高优先级）

- 数据来源：`category_rules` 表
- 匹配方式：`(description + " " + counterparty).toLowerCase()` 包含 `keyword.toLowerCase()`
- 多规则命中时选 `priority` 最高的；相同 priority 取第一个命中的（`>` 而非 `>=`）
- 规则类型：`default`（系统预设）/ `user`（用户手动添加）/ `learned`（用户纠正自动生成）

### Step 2：模糊词表匹配（fuzzyClassify）

按以下**严格优先级顺序**检查，首个命中即返回：

| 优先级 | 分类 | 匹配源 | 词表大小 |
|--------|------|--------|---------|
| 1 | housing | counterparty | 房东/物业/自如/链家 |
| 2 | subscription | combined (desc+cp) | 88vip/api/月费/年费/adspower/saas 等 |
| 3 | medical | combined | 药品/药店/药房/大药房/中草药/太子参 等 |
| 4 | shopping (cp) | counterparty + desc | 拼多多/名创优品/三只松鼠 等 |
| 5 | shopping (word) | combined | 旗舰店/奶粉/纸尿裤/玩具/鞋/日用 等 ~50词 |
| 6 | food (cp) | counterparty + desc | 盒马/饿了么/美团/海底捞 等 ~20家 |
| 7 | food (word) | combined | 饭/面/粉/奶茶/火锅/套餐 等 ~80词 |
| 8 | transport | combined | 单车/顺风车/快车/代驾 等 |
| 9 | entertainment | combined | 门票/景区/演出/展览 等 |

**设计要点**：
- 购物词表在食品词表之前检查，防止母婴用品（奶粉、纸尿裤）被误分类为食品
- 购物交易方在购物关键字之前检查，先看 counterparty 再看 description
- 住房最优先，因为交易方信号最强（房东/物业通常不会歧义）

### Step 3：启发式回退（Heuristic Fallbacks）

针对无法被词表覆盖的特殊模式：

| 分类 | 匹配规则 |
|------|---------|
| transfer_self | 正则匹配：余利宝/余额宝/理财/基金/零钱通/银行卡转入/银行卡定时转入 |
| transfer_self | `网商银行` + (`转入` 或 `转账`) |
| transfer | 描述为 `/` 或空或 `-`，且有 counterparty |
| transfer | 包含 `亲情卡` |
| income_other | 包含 `一淘` + `提现` |
| shopping | 包含 `lidi`（不区分大小写）或 `黎蒂` |
| food | 包含 `客小妹` |
| uncategorized | 以上均不命中 |

## 规则缓存机制

- 首次调用 `classifyTransaction()` 时从 DB 加载规则到内存
- 后续调用直接使用缓存，不再查询 DB
- `clearRulesCache()` 清除缓存，下次调用重新加载
- 用户修改分类规则后需调用 `clearRulesCache()`

## 用户学习机制

当用户在交易详情页修改分类时（`PATCH /api/transactions/[id]`）：
1. 从交易的 counterparty（优先）或 description 前10字符提取关键词
2. 自动创建 `source: 'learned'` 的分类规则
3. 调用 `clearRulesCache()` 使新规则立即生效
4. 后续相同关键词的交易将在 Step 1 阶段被匹配

## 批量分类

`classifyTransactions(transactions[])`:
- 一次性加载规则，使用同步版本 `classifyTransactionSync()` 逐条处理
- 已有 `category_slug` 的交易保留不覆盖（短路 `||`）

## API 集成点

| 场景 | 调用位置 |
|------|---------|
| 导入时分类 | `POST /api/import/csv`、`POST /api/import/excel`、`POST /api/import/ocr` |
| 入库时分类 | `POST /api/transactions` |
| 重分类 | `POST /api/transactions/reclassify` |
| 批量修正 | `POST /api/transactions/fix-all` |

## 测试覆盖

`src/lib/categories/__tests__/engine.test.ts` — 86 个用例：
- 规则缓存机制（3）
- DB 规则匹配（6）
- fuzzyClassify 优先级链（44）
- 启发式回退（23）
- 批量分类（4）
- 优先级冲突（6）
