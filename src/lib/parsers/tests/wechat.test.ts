import { describe, it, expect } from 'vitest';
import { isWechatCSV, parseWechatCSV } from '@/lib/parsers/wechat';

describe('isWechatCSV', () => {
  it('1. 商品+交易对方+收/支 → true', () => {
    expect(isWechatCSV(['商品', '交易对方', '收/支'])).toBe(true);
  });

  it('2. 金额(元)+交易对方 → true', () => {
    expect(isWechatCSV(['金额(元)', '交易对方'])).toBe(true);
  });

  it('3. 交易类型+商品+收/支 → true', () => {
    expect(isWechatCSV(['交易类型', '商品', '收/支'])).toBe(true);
  });

  it('4. 含tab/空格 → true', () => {
    expect(isWechatCSV([' 商品\t', '\t交易对方 ', ' 收/支'])).toBe(true);
  });

  it('5. 空headers → false', () => {
    expect(isWechatCSV([])).toBe(false);
  });

  it('6. 不匹配 → false', () => {
    expect(isWechatCSV(['姓名', '地址', '电话'])).toBe(false);
  });
});

describe('parseWechatCSV', () => {
  const makeRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
    '交易时间': '2024-01-15 10:30:00',
    '交易类型': '商户消费',
    '交易对方': '美团',
    '商品': '外卖订单',
    '收/支': '支出',
    '金额(元)': '35.00',
    '支付方式': '零钱',
    '当前状态': '支付成功',
    '交易单号': 'WX2024010100001',
    ...overrides,
  });

  it('7. 标准支出行 → source=wechat, amount为负', () => {
    const result = parseWechatCSV([makeRow()]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('wechat');
    expect(result[0].amount).toBe(-35.00);
    expect(result[0].type).toBe('expense');
  });

  it('8. 标准收入行 → amount为正', () => {
    const result = parseWechatCSV([makeRow({ '收/支': '收入' })]);
    expect(result[0].amount).toBe(35.00);
    expect(result[0].type).toBe('income');
  });

  it('9. 已退款 → isRefund → income', () => {
    const result = parseWechatCSV([makeRow({ '当前状态': '已退款', '收/支': '支出' })]);
    expect(result[0].type).toBe('income');
    expect(result[0].amount).toBe(35.00);
  });

  it('10. 部分退款 → income', () => {
    const result = parseWechatCSV([makeRow({ '当前状态': '部分退款', '收/支': '支出' })]);
    expect(result[0].type).toBe('income');
    expect(result[0].amount).toBe(35.00);
  });

  it('11. 收/支=/ 非退款 → transfer 类型', () => {
    const result = parseWechatCSV([makeRow({ '收/支': '/', '当前状态': '支付成功' })]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('transfer');
    expect(result[0].amount).toBe(35);
  });

  it('12. 收/支=空 非退款 → 跳过', () => {
    const result = parseWechatCSV([makeRow({ '收/支': '', '当前状态': '支付成功' })]);
    expect(result).toHaveLength(0);
  });

  it('13. 收/支=/ 但是退款 → 不跳过', () => {
    const result = parseWechatCSV([makeRow({ '收/支': '/', '当前状态': '已退款' })]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('income');
  });

  it('14. 零金额跳过', () => {
    const result = parseWechatCSV([makeRow({ '金额(元)': '0.00' })]);
    expect(result).toHaveLength(0);
  });

  it('15. NaN金额跳过', () => {
    const result = parseWechatCSV([makeRow({ '金额(元)': 'abc' })]);
    expect(result).toHaveLength(0);
  });

  it('16. 无日期跳过', () => {
    const result = parseWechatCSV([makeRow({ '交易时间': '' })]);
    expect(result).toHaveLength(0);
  });

  it('17. 日期含/ → 转换为-', () => {
    const result = parseWechatCSV([makeRow({ '交易时间': '2024/01/15 10:30:00' })]);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('18. 金额含¥和逗号 → 正确解析', () => {
    const result = parseWechatCSV([makeRow({ '金额(元)': '¥1,280.50' })]);
    expect(result[0].amount).toBe(-1280.50);
  });

  it('19. 无交易单号 → source_id为null', () => {
    const result = parseWechatCSV([makeRow({ '交易单号': '' })]);
    expect(result[0].source_id).toBeNull();
  });

  it('20. 无支付方式 → 默认微信支付', () => {
    const result = parseWechatCSV([makeRow({ '支付方式': '' })]);
    expect(result[0].payment_method).toBe('微信支付');
  });

  it('21. 描述fallback到交易类型（无商品列）', () => {
    const row = makeRow();
    row['商品'] = '';
    const result = parseWechatCSV([row]);
    expect(result[0].description).toBe('商户消费');
  });

  it('22. 多行解析', () => {
    const result = parseWechatCSV([makeRow(), makeRow({ '交易单号': 'WX2024010100002' })]);
    expect(result).toHaveLength(2);
  });

  it('23. 列名含tab', () => {
    const row = { '\t交易时间\t': '2024-01-15 10:30:00', '\t交易类型\t': '消费', '\t交易对方\t': '商家', '\t商品\t': '购物', '\t收/支\t': '支出', '\t金额(元)\t': '20.00', '\t支付方式\t': '零钱', '\t当前状态\t': '支付成功', '\t交易单号\t': 'WX001' };
    const result = parseWechatCSV([row]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-20.00);
  });
});
