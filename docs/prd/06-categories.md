# 06 分类管理

## 功能概述

用户可自定义交易分类，包括新增、编辑、删除分类，以及分类的图标和颜色定制。

## 页面

`src/app/categories/page.tsx`

## 功能列表

### 分类展示
- 支出分类和收入分类分区展示
- 每个分类显示：图标、名称、颜色色块

### 新增分类
- 输入名称，自动生成 slug（拼音或随机）
- 选择图标（24+ Lucide 图标网格选择器）
- 选择颜色（20 种预设色板）
- 指定为支出类或收入类
- sort_order 自动递增

### 编辑分类
- 内联编辑名称、图标、颜色
- 即时 PATCH 保存

### 删除分类
- `uncategorized` 不可删除
- 删除时级联处理：
  1. 该分类下所有交易迁移到 `uncategorized`
  2. 删除关联的分类规则
  3. 删除分类本身

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/categories` | 获取所有分类 |
| POST | `/api/categories` | 创建新分类（校验 slug 唯一性） |
| PATCH | `/api/categories/[slug]` | 更新分类属性 |
| DELETE | `/api/categories/[slug]` | 删除分类（级联处理） |
| POST | `/api/categories/migrate` | 一次性数据迁移（添加 transfer_self/credit_card） |

## 图标系统

文件：`src/lib/utils/icons.ts`

- 使用 Lucide React 图标库
- `getIcon(name)` 函数：名称 → 图标组件映射
- 默认图标：CircleDashed
- 注册约 40 个常用图标

## 默认分类（18个）

详见 [01-data-model.md](./01-data-model.md) 种子数据部分。
