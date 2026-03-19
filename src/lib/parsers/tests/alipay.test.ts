import { describe, it, expect } from 'vitest';
import { isAlipayCSV, parseAlipayCSV } from '@/lib/parsers/alipay';

describe('isAlipayCSV', () => {
  it('1. 2个ALIPAY_HEADERS命中 → true', () => {
    expect(isAlipayCSV(['交易号', '交易状态'])).toBe(true);
  });

  it('2. 3个ALIPAY_HEADERS → true', () => {
    expect(isAlipayCSV(['交易号', '交易状态', '交易金额'])).toBe(true);
  });

  it('3. 仅1个不够 → false', () => {
    expect(isAlipayCSV(['交易号', '日期'])).toBe(false);
  });

  it('4. 商家订单号+收/支 → true（备选条件1）', () => {
    expect(isAlipayCSV(['商家订单号', '收/支'])).toBe(true);
  });

  it('5. 交易对方+交易状态+金额 → true（备选条件2 has金额）', () => {
    expect(isAlipayCSV(['交易对方', '交易状态', '金额'])).toBe(true);
  });

  it('6. 交易对方+交易状态+交易金额 → true（has交易金额）', () => {
    expect(isAlipayCSV(['交易对方', '交易状态', '交易金额'])).toBe(true);
  });

  it('7. headers含tab/空格 → true（trim+replace）', () => {
    expect(isAlipayCSV([' 交易号\t', '\t交易状态 '])).toBe(true);
  });

  it('8. 空headers → false', () => {
    expect(isAlipayCSV([])).toBe(false);
  });

  it('9. 完全无关headers → false', () => {
    expect(isAlipayCSV(['姓名', '地址'])).toBe(false);
  });

  it('10. 微信headers不误判 → false', () => {
    expect(isAlipayCSV(['商品', '交易对方', '收/支'])).toBe(false);
  });
});

describe('parseAlipayCSV', () => {
  const makeRow = (overrides: Record<string, string> = {}): Record<string, string> => ({
    '交易号': '2024010100001',
    '交易创建时间': '2024-01-15 10:30:00',
    '交易金额': '128.50',
    '收/支': '支出',
    '交易状态': '交易成功',
    '商品说明': '淘宝购物',
    '交易对方': '淘宝商家',
    '收/付款方式': '余额宝',
    '备注': '',
    ...overrides,
  });

  it('11. 标准支出行 → source=alipay, amount为负, type=expense', () => {
    const result = parseAlipayCSV([makeRow()]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('alipay');
    expect(result[0].amount).toBe(-128.50);
    expect(result[0].type).toBe('expense');
  });

  it('12. 标准收入行 → amount为正, type=income', () => {
    const result = parseAlipayCSV([makeRow({ '收/支': '收入' })]);
    expect(result[0].amount).toBe(128.50);
    expect(result[0].type).toBe('income');
  });

  it('13. 已收入状态 → income', () => {
    const result = parseAlipayCSV([makeRow({ '收/支': '已收入' })]);
    expect(result[0].type).toBe('income');
    expect(result[0].amount).toBe(128.50);
  });

  it('14. 退款(状态含退款) → isRefund → income', () => {
    const result = parseAlipayCSV([makeRow({ '交易状态': '退款成功', '收/支': '支出' })]);
    expect(result[0].type).toBe('income');
    expect(result[0].amount).toBe(128.50);
  });

  it('15. 退款(交易分类含退款，desc不含退款) → 独立走clean(交易分类)分支', () => {
    // 商品说明非空且不含退款 → desc='普通商品'，不触发desc.includes('退款')
    // 交易分类='退款' → 触发clean('交易分类').includes('退款')
    const result = parseAlipayCSV([makeRow({
      '交易状态': '交易成功',
      '收/支': '支出',
      '商品说明': '普通商品',
      '交易分类': '退款',
    })]);
    expect(result[0].type).toBe('income');
    expect(result[0].description).toBe('普通商品'); // 确认desc不含退款
  });

  it('16. 退款(描述含退款，交易分类不含退款) → 独立走desc分支', () => {
    // 商品说明含退款 → desc='退款-淘宝购物'，触发desc.includes('退款')
    // 交易分类不含退款 → 不触发clean('交易分类')分支
    const result = parseAlipayCSV([makeRow({
      '交易状态': '交易成功',
      '收/支': '支出',
      '商品说明': '退款-淘宝购物',
      '交易分类': '日用百货',
    })]);
    expect(result[0].type).toBe('income');
    expect(result[0].description).toBe('退款-淘宝购物');
  });

  it('17. 跳过交易关闭 → 0条', () => {
    const result = parseAlipayCSV([makeRow({ '交易状态': '交易关闭' })]);
    expect(result).toHaveLength(0);
  });

  it('18. 跳过关闭 → 0条', () => {
    const result = parseAlipayCSV([makeRow({ '交易状态': '关闭' })]);
    expect(result).toHaveLength(0);
  });

  it('19. 跳过零金额 → 0条', () => {
    const result = parseAlipayCSV([makeRow({ '交易金额': '0' })]);
    expect(result).toHaveLength(0);
  });

  it('20. 跳过NaN金额 → 0条', () => {
    const result = parseAlipayCSV([makeRow({ '交易金额': 'abc' })]);
    expect(result).toHaveLength(0);
  });

  it('21. 跳过无日期 → 0条', () => {
    const result = parseAlipayCSV([makeRow({ '交易创建时间': '', '付款时间': '' })]);
    expect(result).toHaveLength(0);
  });

  it('22. 金额含¥ → 正确解析', () => {
    const result = parseAlipayCSV([makeRow({ '交易金额': '¥128.50' })]);
    expect(result[0].amount).toBe(-128.50);
  });

  it('23. 金额含￥ → 正确解析', () => {
    const result = parseAlipayCSV([makeRow({ '交易金额': '￥99.00' })]);
    expect(result[0].amount).toBe(-99.00);
  });

  it('24. 金额含逗号 → 正确解析', () => {
    const result = parseAlipayCSV([makeRow({ '交易金额': '1,280.50' })]);
    expect(result[0].amount).toBe(-1280.50);
  });

  it('25. 日期含/ → 转换为-', () => {
    const result = parseAlipayCSV([makeRow({ '交易创建时间': '2024/01/15 10:30:00' })]);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('26. 备选列名 付款时间', () => {
    const row = makeRow();
    delete row['交易创建时间'];
    row['付款时间'] = '2024-02-20 08:00:00';
    const result = parseAlipayCSV([row]);
    expect(result[0].date).toBe('2024-02-20');
  });

  it('27. 备选列名 金额（元）', () => {
    const row = makeRow();
    delete row['交易金额'];
    row['金额（元）'] = '55.00';
    const result = parseAlipayCSV([row]);
    expect(result[0].amount).toBe(-55.00);
  });

  it('28. 备选列名 商品名称', () => {
    const row = makeRow();
    delete row['商品说明'];
    row['商品名称'] = '美团外卖';
    const result = parseAlipayCSV([row]);
    expect(result[0].description).toBe('美团外卖');
  });

  it('29. 备选列名 交易订单号作为source_id', () => {
    const row = makeRow();
    delete row['交易号'];
    row['交易订单号'] = 'ORDER123';
    const result = parseAlipayCSV([row]);
    expect(result[0].source_id).toBe('ORDER123');
  });

  it('30. source_id无 → null', () => {
    const row = makeRow();
    row['交易号'] = '';
    row['交易订单号'] = '';
    const result = parseAlipayCSV([row]);
    expect(result[0].source_id).toBeNull();
  });

  it('31. 无备注 → note为undefined', () => {
    const result = parseAlipayCSV([makeRow({ '备注': '' })]);
    expect(result[0].note).toBeUndefined();
  });

  it('32. 有备注 → note有值', () => {
    const result = parseAlipayCSV([makeRow({ '备注': '报销' })]);
    expect(result[0].note).toBe('报销');
  });

  it('33. 无收/付款方式 → 默认支付宝', () => {
    const row = makeRow();
    row['收/付款方式'] = '';
    const result = parseAlipayCSV([row]);
    expect(result[0].payment_method).toBe('支付宝');
  });

  it('34. 多行解析 → 2条记录', () => {
    const result = parseAlipayCSV([makeRow(), makeRow({ '交易号': '2024010100002' })]);
    expect(result).toHaveLength(2);
  });

  it('35. 列名含tab → 正常匹配', () => {
    const row = { '\t交易号\t': '2024010100001', '\t交易创建时间\t': '2024-01-15 10:30:00', '\t交易金额\t': '50.00', '\t收/支\t': '支出', '\t交易状态\t': '交易成功', '\t商品说明\t': '购物', '\t交易对方\t': '商家', '\t收/付款方式\t': '余额宝' };
    const result = parseAlipayCSV([row]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(-50.00);
  });
});
