# 05 交易管理

## 功能概述

交易记录的查看、筛选、分类编辑、删除，以及批量修正和重分类功能。

## 页面

`src/app/transactions/page.tsx`

## 功能列表

### 交易列表
- 按日期分组展示
- 每条显示：描述、交易对方、金额、分类标签
- 分页：每页 50 条

### 筛选
- **时间范围**：全部 / 本月 / 上月
- **文本搜索**：描述和交易对方模糊匹配
- **分类筛选**：通过 URL 参数 `category` 跳转（从报表页面点击分类进入）

### 内联分类编辑
- 点击分类标签展开 5 列分类网格
- 选择新分类后立即 PATCH 更新
- 自动生成 `learned` 规则（用户学习机制，详见 [03-classification.md](./03-classification.md)）

### 删除
- hover 显示删除按钮
- 确认后硬删除

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/transactions` | 列表查询（支持 startDate/endDate/category/search/type/limit/offset） |
| POST | `/api/transactions` | 批量导入（导入确认后调用，自动运行分类引擎） |
| GET | `/api/transactions/[id]` | 单条查询 |
| PATCH | `/api/transactions/[id]` | 更新（分类/描述/备注等），修改分类时触发规则学习 |
| DELETE | `/api/transactions/[id]` | 删除单条 |

### 批量修正

**端点**：`POST /api/transactions/fix-all`

硬编码的修正规则，用于修复已知的分类错误：
- 母婴用品（奶粉、纸尿裤等）→ shopping
- 中药材（太子参等）→ medical
- 88VIP → subscription
- 误标为 expense 的退款 → income

### 重分类

**端点**：`POST /api/transactions/reclassify`

- **模式一**（`all=true`）：对所有非手动录入交易重新运行分类引擎
- **模式二**（默认）：仅对 uncategorized 的交易重新分类
- 跳过已有 `learned` 规则匹配的交易
- 分批更新，每批 100 条
