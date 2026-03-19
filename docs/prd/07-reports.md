# 07 报表与可视化

## 功能概述

提供多维度财务数据可视化，包括月度概览、趋势分析、消费热力图和周期性支出检测。

## 页面

### 首页仪表盘 (`src/app/page.tsx`)

展示内容：
1. **消费热力图**（GitHub 风格）：可选 1/3/6/12 个月范围，4 级红色强度
2. **月度收支卡片**：本月收入/支出金额 + 环比变化百分比
3. **分类柱状图**：各支出分类排名，点击跳转交易列表
4. **统计排除项**：信用卡还款和自转账单独展示
5. **周期性支出**：自动检测的固定支出列表 + 月度总额
6. **6 个月趋势折线图**

### 报表详情页 (`src/app/reports/page.tsx`)

展示内容：
1. **月份导航**：左右箭头切换月份
2. **收支汇总**：收入/支出/结余 + 环比对比
3. **分类饼图**：各分类支出占比（Top 5 图例）
4. **分类排行**：按金额排序，可展开查看该分类下具体交易
5. **排除项说明**
6. **月度对比柱状图**

## 图表组件

| 组件 | 文件 | 说明 |
|------|------|------|
| CategoryBar | `src/components/charts/category-bar.tsx` | 水平柱状图，分类颜色 + 图标 |
| CategoryPie | `src/components/charts/category-pie.tsx` | 环形饼图（Recharts），Top 5 图例 |
| Heatmap | `src/components/charts/heatmap.tsx` | GitHub 风格热力日历，可点击显示详情 |
| MonthlyCompare | `src/components/charts/monthly-compare.tsx` | 分组柱状图：月度收入 vs 支出 |
| TrendLine | `src/components/charts/trend-line.tsx` | 折线图：N 月收支趋势 |

## API 端点

### GET `/api/reports`

通过 `type` 参数区分三种模式：

**summary**（默认）：
- 本月收入/支出/结余
- 分类维度支出明细
- 日维度支出数据
- 环比变化率（vs 上月）

**trend**：
- N 个月（默认 6）的月度收入/支出序列

**heatmap**：
- 日期范围内的每日支出金额

### GET `/api/reports/recurring`

**周期性支出检测算法**：
1. 最近 3 个月的支出数据
2. 按 counterparty/description 分组聚合
3. 筛选条件：≥ 2 个月出现 + 金额方差 ≤ 5%
4. 按平均金额降序排列
5. 返回月度周期性支出总额

## 统计排除规则

所有报表聚合自动排除：
- `credit_card`：信用卡还款（避免重复计算）
- `transfer_self`：自转账（余额宝、理财等资金流转）

排除项在 UI 中单独展示，不隐藏。
