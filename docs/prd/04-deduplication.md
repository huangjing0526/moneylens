# 04 去重检测

## 功能概述

在导入交易时检测重复记录，避免同一笔交易被重复计入。支持同源精确去重和跨源模糊去重。

## 核心文件

`src/lib/dedup/index.ts`

## 同源去重

**函数**：`checkSameSourceDuplicate(transaction)`

**匹配条件**：`source` + `source_id` 完全一致

**说明**：同一平台（如支付宝）导出的账单中，每笔交易有唯一的交易号。再次导入相同文件时通过交易号精确排除。

**处理方式**：在导入预览中自动标记为重复，不可选中。

## 跨源去重

**函数**：`findCrossSourceDuplicates(newTransactions)`

**场景**：同一笔消费可能同时出现在支付宝账单和微信账单中（如微信支付通过支付宝付款），或银行账单与第三方支付账单重叠。

**匹配算法**：

1. **金额匹配**：绝对值差 ≤ 0.01（容忍浮点精度）
2. **日期匹配**：±1 天范围内（跨日交易/时区差异）
3. **文本相似度**：描述 + 交易对方的 bigram Jaccard 相似度 ≥ 70%

### Bigram Jaccard 相似度

```
similarity(a, b) = |bigrams(a) ∩ bigrams(b)| / |bigrams(a) ∪ bigrams(b)|
```

- 对中文文本友好（每个字符对作为一个 bigram）
- 空字符串处理：两者均空返回 1.0，仅一方为空返回 0.0
- 阈值：≥ 0.7 判定为疑似重复

**处理方式**：在导入预览中显示警告横幅，由用户决定是否导入。

## API 集成

| 端点 | 说明 |
|------|------|
| POST `/api/import/csv` | 解析后执行同源 + 跨源去重 |
| POST `/api/import/excel` | 同上 |
| POST `/api/deduplicate` | 手动标记某条交易为重复（设置 is_duplicate=1） |

## 返回数据结构

```json
{
  "duplicates": {
    "sameSource": [{ "transactionIndex": 0, "existingId": 123 }],
    "crossSource": [{
      "transaction": { ... },
      "existing": { ... },
      "similarity": 0.85
    }]
  }
}
```

## 软删除

重复交易通过 `is_duplicate = 1` 软删除，所有查询默认过滤 `is_duplicate = 0`。

## 测试覆盖

`src/lib/dedup/tests/dedup.test.ts`
