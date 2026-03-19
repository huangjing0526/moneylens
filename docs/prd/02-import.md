# 02 账单导入

## 功能概述

支持从支付宝、微信支付导出的 CSV/Excel 文件以及截图（OCR）导入交易记录。导入流程：**上传 → 解析 → 分类 → 去重检测 → 预览 → 确认入库**。

## 支持的格式

| 格式 | 来源 | 说明 |
|------|------|------|
| CSV | 支付宝、微信、通用银行 | 自动检测编码（UTF-8 / GBK） |
| Excel (.xlsx) | 支付宝、微信、通用银行 | 自动查找表头行 |
| 图片 | 截图 OCR | 支持 Claude Vision 和 Tesseract.js |

## 解析流程

### 编码处理
1. 尝试 UTF-8 解码
2. 检测是否包含乱码（连续高位字节）
3. 回退到 GBK（iconv-lite）

### 格式自动检测
- **支付宝**：表头包含 "交易号" + "交易订单号" / "交易金额" / "交易状态"（≥2 个匹配）
- **微信**：表头包含 "商品" + "交易对方" + "收/支" 或 "金额(元)" + "交易对方"
- **通用**：正则匹配日期列 + 金额列

### CSV 预处理
- 跳过文件头部的元数据行（如支付宝的账户信息行）
- 通过检测 CSV 分隔符数量一致性定位真正的数据起始行

### Excel 预处理
- 扫描前 20 行查找包含已知表头关键词的行作为 header row
- 处理 Excel 日期序列号转换

## 支付宝解析器 (`src/lib/parsers/alipay.ts`)

**检测**：`isAlipayCSV(headers)` — 匹配 ≥2 个特征列名

**解析规则**：
- 跳过 "交易关闭" 状态的记录
- 退款识别：状态或描述包含 "退款" → type 设为 income
- source_id 取自 "交易号" 列
- 金额取绝对值后根据收/支方向设置正负

## 微信解析器 (`src/lib/parsers/wechat.ts`)

**检测**：`isWechatCSV(headers)` — 匹配特征列组合

**解析规则**：
- 跳过 "收/支" 为 "/" 或空的记录（余额查询等非交易条目）
- "已退款" 状态视为收入
- source_id 取自 "交易单号"
- 金额前缀 "¥" 自动去除

## OCR 解析 (`src/app/api/import/ocr/route.ts`)

**双引擎策略**：

1. **Claude Vision**（优先，需配置 `ANTHROPIC_API_KEY`）
   - 发送图片到 Claude claude-sonnet-4-20250514
   - 结构化 prompt 要求返回 JSON 数组
   - 超时：60 秒

2. **Tesseract.js**（兜底）
   - 本地 OCR，语言包：`chi_sim+eng`
   - 正则提取日期和金额
   - 精度较低，适合简单格式截图

## 导入预览组件

**FileUpload** (`src/components/import/file-upload.tsx`)：
- 拖拽上传 / 点击选择
- 多阶段进度展示：上传 → 解析 → 分类 → 完成
- 计时器显示耗时
- 支持 AbortController 取消
- 三个快捷入口按钮：支付宝 / 微信 / 截图

**ImportPreview** (`src/components/import/import-preview.tsx`)：
- 按日期分组展示
- 同源重复自动排除（不可选）
- 跨源重复显示警告横幅
- 显示来源标签和数量汇总
- 用户可逐条勾选/取消

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/csv` | CSV 上传解析 |
| POST | `/api/import/excel` | Excel 上传解析 |
| POST | `/api/import/ocr` | 图片 OCR 解析 |

所有端点返回格式：
```json
{
  "source": "alipay",
  "transactions": [...],
  "duplicates": { "sameSource": [...], "crossSource": [...] },
  "debug": { "headers": [...], "rowCount": 0, "sampleRow": {} }
}
```

## 测试覆盖

- `src/lib/parsers/tests/alipay.test.ts` — 支付宝解析器
- `src/lib/parsers/tests/wechat.test.ts` — 微信解析器
- `src/lib/parsers/tests/parser.test.ts` — 通用解析逻辑
