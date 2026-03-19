# MoneyLens 产品需求文档（PRD）

## 产品概述

MoneyLens（钱迹）是一款面向个人/家庭的记账与财务分析工具，以 Web 应用形式部署。核心价值是**将支付宝、微信账单等原始数据自动导入、分类、去重，并生成可视化财务报告**。

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | Turso (libsql / SQLite) |
| 图表 | Recharts |
| OCR | Claude Vision（优先）/ Tesseract.js（兜底） |
| CSV/Excel | papaparse + xlsx + iconv-lite (GBK) |

## 模块索引

| 模块 | PRD 文件 | 说明 |
|------|---------|------|
| 数据模型与存储 | [01-data-model.md](./01-data-model.md) | 数据库表结构、类型定义、种子数据 |
| 账单导入 | [02-import.md](./02-import.md) | CSV/Excel/OCR 解析、编码处理、格式检测 |
| 自动分类引擎 | [03-classification.md](./03-classification.md) | 三级分类流水线、规则缓存、用户学习 |
| 去重检测 | [04-deduplication.md](./04-deduplication.md) | 同源去重、跨源去重、相似度算法 |
| 交易管理 | [05-transactions.md](./05-transactions.md) | 列表筛选、手动编辑、批量修正、重分类 |
| 分类管理 | [06-categories.md](./06-categories.md) | CRUD、图标/颜色、删除级联 |
| 报表与可视化 | [07-reports.md](./07-reports.md) | 月度概览、趋势、热力图、周期性开支 |
| 认证与安全 | [08-auth.md](./08-auth.md) | 密码登录、Cookie 鉴权、中间件 |
| 快捷记账 | [09-quick-add.md](./09-quick-add.md) | 计算器面板、分类选择、手动录入 |

## 数据流总览

```
文件上传 ─→ 解析器(Alipay/WeChat/Generic/OCR)
         ─→ 分类引擎(DB规则 > 模糊词表 > 启发式)
         ─→ 去重检测(同源精确 / 跨源相似度)
         ─→ 用户预览确认
         ─→ 写入数据库
         ─→ 报表聚合(排除信用卡/自转账)
```

## 关键业务规则

1. **信用卡还款和自转账**（余额宝、理财等）记录但不计入收支统计
2. **退款**自动识别为收入（支付宝/微信解析器内处理）
3. **用户手动修改分类**时自动生成 `learned` 规则，后续相似交易自动采用
4. **跨源去重**：金额一致（±0.01）+ 日期相近（±1天）+ 描述相似度 ≥ 70%
