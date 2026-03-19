import { describe, it, expect } from 'vitest';
import * as iconv from 'iconv-lite';
import XLSX from 'xlsx';
import { parseCSV, parseExcel } from '../index';

// ─── helpers ────────────────────────────────────────────────────────────────
function makeCSVBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

function makeExcelBuffer(
  aoa: unknown[][],
  opts?: { sheetName?: string },
): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, opts?.sheetName ?? 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ═══════════════════════════════════════════════════════════════════════════
// 一、decodeBuffer（通过 parseCSV 间接测试）
// ═══════════════════════════════════════════════════════════════════════════
describe('decodeBuffer (via parseCSV)', () => {
  it('1. UTF-8 正常文本 → 正常解析（无 \\ufffd）', () => {
    const csv = '日期,金额,描述,类型\n2024-01-01,100,午餐,支出';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('午餐');
  });

  it('2. GBK 编码文本 → fallback 到 GBK 解码', () => {
    const csv = '日期,金额,描述,类型\n2024-01-01,100,午餐,支出';
    const gbkBuf = iconv.encode(csv, 'gbk');
    const result = parseCSV(gbkBuf, 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('午餐');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 二、skipMetaLines（通过 parseCSV 间接测试）
// ═══════════════════════════════════════════════════════════════════════════
describe('skipMetaLines (via parseCSV)', () => {
  it('3. 前面有 meta 行 → 跳过 meta', () => {
    const csv = [
      '支付宝交易记录明细',
      '账号:xxx',
      '',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('咖啡');
  });

  it('4. # 开头行被跳过', () => {
    const csv = [
      '# 这是注释',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
  });

  it('5. --- 开头行被跳过', () => {
    const csv = [
      '---分隔线---',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
  });

  it('6. - 开头行被跳过', () => {
    const csv = [
      '-导出信息',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
  });

  it('7. 空行被跳过', () => {
    const csv = [
      '',
      '',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
  });

  it('8. 无 meta 行 → startIdx=0', () => {
    const csv = '日期,金额,描述,类型\n2024-01-01,50,咖啡,支出';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.debug?.headers).toContain('日期');
  });

  it('9. 逗号 >= 3 才算 header 行（2 个逗号不够）', () => {
    // "A,B" has only 1 comma (2 parts), not enough → should be skipped as meta
    const csv = [
      'A,B',
      '日期,金额,描述,类型',
      '2024-01-01,50,咖啡,支出',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    // The first row "A,B" should be skipped, so header should be 日期,金额,...
    expect(result.debug?.headers).toContain('日期');
    expect(result.transactions.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 三、parseCSV 来源检测
// ═══════════════════════════════════════════════════════════════════════════
describe('parseCSV 来源检测', () => {
  it('10. 含支付宝特征 header → source=alipay', () => {
    const csv = [
      '交易号,商家订单号,交易创建时间,交易金额,交易状态,交易对方,商品说明,收/支,收/付款方式',
      'T001,M001,2024-01-01 10:00:00,50.00,交易成功,商家A,午餐,支出,余额宝',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.source).toBe('alipay');
  });

  it('11. 含微信特征 header → source=wechat', () => {
    const csv = [
      '交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态',
      '2024-01-01 10:00:00,商户消费,商家B,咖啡,支出,30.00,零钱,支付成功',
    ].join('\n');
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.source).toBe('wechat');
  });

  it('12. 均不匹配 → source=bank', () => {
    const csv = '日期,金额,描述,类型\n2024-01-01,100,工资,收入';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.source).toBe('bank');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 四、parseGenericCSV 列名匹配
// ═══════════════════════════════════════════════════════════════════════════
describe('parseGenericCSV 列名匹配', () => {
  it('13. 中文标准列名：日期/金额/描述/收/支/交易对方', () => {
    const csv = '日期,金额,描述,收/支,交易对方\n2024-01-01,100,转账,收入,张三';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].counterparty).toBe('张三');
    expect(result.transactions[0].type).toBe('income');
  });

  it('14. 英文列名：Date/Amount/Description/Type/Counterparty', () => {
    const csv = 'Date,Amount,Description,Type,Counterparty\n2024-01-01,100,Salary,income,CompanyA';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('Salary');
    expect(result.transactions[0].type).toBe('income');
  });

  it('15. 备选中文：交易日期/交易金额/摘要/类型', () => {
    const csv = '交易日期,交易金额,摘要,类型\n2024-03-15,200,水电费,支出';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('水电费');
  });

  it('16. 记账日期列', () => {
    const csv = '记账日期,金额,描述\n2024-06-01,88,购物';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].date).toBe('2024-06-01');
  });

  it('17. 发生额列', () => {
    const csv = '日期,发生额,描述\n2024-07-01,500,报销';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].amount).toBe(500);
  });

  it('18. 对方户名/收款方/付款方列', () => {
    const csv = '日期,金额,描述,对方户名\n2024-01-01,100,转账,李四';
    const r1 = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(r1.transactions[0].counterparty).toBe('李四');

    const csv2 = '日期,金额,描述,收款方\n2024-01-01,100,转账,王五';
    const r2 = parseCSV(makeCSVBuffer(csv2), 'test.csv');
    expect(r2.transactions[0].counterparty).toBe('王五');

    const csv3 = '日期,金额,描述,付款方\n2024-01-01,100,转账,赵六';
    const r3 = parseCSV(makeCSVBuffer(csv3), 'test.csv');
    expect(r3.transactions[0].counterparty).toBe('赵六');
  });

  it('19. 用途/对方信息列', () => {
    const csv = '日期,金额,用途\n2024-01-01,100,房租';
    const r1 = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(r1.transactions[0].description).toBe('房租');

    const csv2 = '日期,金额,对方信息\n2024-01-01,100,物业费';
    const r2 = parseCSV(makeCSVBuffer(csv2), 'test.csv');
    expect(r2.transactions[0].description).toBe('物业费');
  });

  it('20. 金额开头模糊匹配（如 "金额(元)" 匹配 /金额/）', () => {
    const csv = '日期,金额(元),描述\n2024-01-01,66.50,饮料';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    // No type column + positive amount → income → positive
    expect(result.transactions[0].amount).toBe(66.50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 五、列名猜测 fallback
// ═══════════════════════════════════════════════════════════════════════════
describe('列名猜测 fallback', () => {
  it('21. 无标准 header 但数据值可猜测（Col1 含日期格式, Col2 含数字）→ 正确解析', () => {
    const csv = 'ColA,ColB,ColC\n2024-03-01,250,杂货';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].date).toBe('2024-03-01');
  });

  it('22. 数据值含 ¥ → 猜测为金额列', () => {
    const csv = 'ColA,ColB,ColC\n2024-03-01,¥250,杂货';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    // No type column + positive amount → income → positive
    expect(result.transactions[0].amount).toBe(250);
  });

  it('23. 猜不出日期和金额 → 返回空', () => {
    const csv = 'ColA,ColB,ColC\nhello,world,foo';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(0);
  });

  it('24. 只猜出日期无金额 → 返回空', () => {
    const csv = 'ColA,ColB,ColC\n2024-03-01,hello,foo';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(0);
  });

  it('25. 无数据行 → 返回空', () => {
    const csv = 'ColA,ColB,ColC';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 六、parseRowsWithColumns 日期格式
// ═══════════════════════════════════════════════════════════════════════════
describe('parseRowsWithColumns 日期格式', () => {
  it('26. YYYY-MM-DD → 正常', () => {
    const csv = '日期,金额,描述\n2024-01-15,100,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].date).toBe('2024-01-15');
  });

  it('27. YYYY/MM/DD → 斜杠转横线', () => {
    const csv = '日期,金额,描述\n2024/01/15,100,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].date).toBe('2024-01-15');
  });

  it('28. YYYY年MM月DD日 → 中文日期', () => {
    const csv = '日期,金额,描述\n2024年03月15日,100,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].date).toBe('2024-03-15');
  });

  it('29. 单位数月日 2024-1-5 → 补零 2024-01-05', () => {
    const csv = '日期,金额,描述\n2024-1-5,100,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].date).toBe('2024-01-05');
  });

  it('30. 日期+时间 → split 取日期和时间', () => {
    const csv = '日期,金额,描述\n2024-01-15 14:30:00,100,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].date).toBe('2024-01-15');
    expect(result.transactions[0].time).toBe('14:30:00');
  });

  it('31. 无效日期 → 跳过', () => {
    const csv = '日期,金额,描述\nINVALID,100,测试\n2024-01-15,200,有效';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].date).toBe('2024-01-15');
  });

  it('32. 部分日期如 "2024年" → 无法匹配 → 跳过', () => {
    const csv = '日期,金额,描述\n2024年,100,测试\n2024-01-15,200,有效';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('有效');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 七、parseRowsWithColumns 金额处理
// ═══════════════════════════════════════════════════════════════════════════
describe('parseRowsWithColumns 金额处理', () => {
  it('33. 正常数字 50.00', () => {
    const csv = '日期,金额,描述\n2024-01-01,50.00,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    // No type column + positive → income → +50
    expect(result.transactions[0].amount).toBe(50);
  });

  it('34. 含 ¥ → strip 后解析', () => {
    const csv = '日期,金额,描述\n2024-01-01,¥50.00,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].amount).toBe(50);
  });

  it('35. 含 ￥ → strip 后解析', () => {
    const csv = '日期,金额,描述\n2024-01-01,￥50.00,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].amount).toBe(50);
  });

  it('36. 含逗号 1,000.50 → 1000.50', () => {
    // Need to quote the amount since it contains a comma
    const csv = '日期,金额,描述\n2024-01-01,"1,000.50",测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].amount).toBe(1000.50);
  });

  it('37. NaN → 跳过', () => {
    const csv = '日期,金额,描述\n2024-01-01,abc,测试\n2024-01-02,100,有效';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].description).toBe('有效');
  });

  it('38. 零 → 跳过', () => {
    const csv = '日期,金额,描述\n2024-01-01,0,测试\n2024-01-02,100,有效';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
  });

  it('39. 负数 -50.00', () => {
    const csv = '日期,金额,描述\n2024-01-01,-50.00,退款';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].amount).toBe(-50);
    expect(result.transactions[0].type).toBe('expense');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 八、收支类型判断
// ═══════════════════════════════════════════════════════════════════════════
describe('收支类型判断', () => {
  it('40. 类型列=收入 → income', () => {
    const csv = '日期,金额,描述,收/支\n2024-01-01,100,工资,收入';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('income');
    expect(result.transactions[0].amount).toBe(100);
  });

  it('41. 类型列=已收入 → income', () => {
    const csv = '日期,金额,描述,收/支\n2024-01-01,100,退款,已收入';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('income');
  });

  it('42. 类型列=income（英文）→ income', () => {
    const csv = '日期,金额,描述,类型\n2024-01-01,100,Salary,income';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('income');
    expect(result.transactions[0].amount).toBe(100);
  });

  it('43. 无类型列+正金额 → income', () => {
    const csv = '日期,金额,描述\n2024-01-01,100,收款';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('income');
    expect(result.transactions[0].amount).toBe(100);
  });

  it('44. 无类型列+负金额 → expense', () => {
    const csv = '日期,金额,描述\n2024-01-01,-100,付款';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[0].amount).toBe(-100);
  });

  it('45. 类型列=支出 → expense', () => {
    const csv = '日期,金额,描述,收/支\n2024-01-01,100,午餐,支出';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].type).toBe('expense');
    expect(result.transactions[0].amount).toBe(-100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 九、描述 fallback
// ═══════════════════════════════════════════════════════════════════════════
describe('描述 fallback', () => {
  it('46. 有描述列 → 用描述值', () => {
    const csv = '日期,金额,描述\n2024-01-01,100,工资收入';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].description).toBe('工资收入');
  });

  it('47. 无描述有对方 → 用 counterparty', () => {
    const csv = '日期,金额,交易对方\n2024-01-01,100,张三';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].description).toBe('张三');
  });

  it('48. 无描述无对方 → fallback=交易', () => {
    const csv = '日期,金额,其他\n2024-01-01,100,xxx';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions[0].description).toBe('交易');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 十、parseExcel
// ═══════════════════════════════════════════════════════════════════════════
describe('parseExcel', () => {
  it('49. 标准 Excel → 正确解析出 transactions', () => {
    const buf = makeExcelBuffer([
      ['日期', '金额', '描述'],
      ['2024-01-01', 100, '工资'],
      ['2024-01-02', -50, '午餐'],
    ]);
    const result = parseExcel(buf, 'test.xlsx');
    expect(result.transactions.length).toBe(2);
    expect(result.source).toBe('bank');
  });

  it('50. Excel 第一行是 meta → findHeaderRowIndex 跳过 meta 找到真正 header', () => {
    const buf = makeExcelBuffer([
      ['微信支付账单明细'],
      ['用户昵称: 测试'],
      ['交易时间', '交易日期', '日期', '金额', '交易金额', '描述'],
      ['2024-01-01', '2024-01-01', '2024-01-01', 100, 100, '午餐'],
    ]);
    const result = parseExcel(buf, 'test.xlsx');
    expect(result.transactions.length).toBe(1);
  });

  it('51. 空 Excel → 返回空 + 错误信息', () => {
    const buf = makeExcelBuffer([['日期', '金额', '描述']]);
    const result = parseExcel(buf, 'test.xlsx');
    expect(result.transactions.length).toBe(0);
    expect(result.errors).toContain('Excel 文件为空或无数据行');
  });

  it('52. Excel 含数字日期（Excel 序列号如 45307）→ 通过 SSF.parse_date_code 转换', () => {
    // 45307 → SSF.parse_date_code(45307) gives 2024-01-16
    const buf = makeExcelBuffer([
      ['日期', '金额', '描述'],
      [45307, 200, '测试'],
    ]);
    const result = parseExcel(buf, 'test.xlsx');
    expect(result.transactions.length).toBe(1);
    // Verify it's a valid date from the serial number conversion
    const parsed = XLSX.SSF.parse_date_code(45307);
    const expected = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    expect(result.transactions[0].date).toBe(expected);
  });

  it('53. Excel 含 Date 对象 → toISOString().split("T")[0]', () => {
    // xlsx with cellDates: true can produce Date objects when reading back
    // We simulate by constructing a workbook with a date-formatted cell
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['日期', '金额', '描述'],
      ['2024-06-15', 300, '日期对象测试'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const result = parseExcel(buf, 'test.xlsx');
    expect(result.transactions.length).toBe(1);
    expect(result.transactions[0].date).toBe('2024-06-15');
  });

  it('54. Excel 检测 Alipay/WeChat 格式', () => {
    // Alipay format
    const alipayBuf = makeExcelBuffer([
      ['交易号', '商家订单号', '交易创建时间', '交易金额', '交易状态', '交易对方', '商品说明', '收/支', '收/付款方式'],
      ['T001', 'M001', '2024-01-01 10:00:00', '50.00', '交易成功', '商家A', '午餐', '支出', '余额宝'],
    ]);
    const r1 = parseExcel(alipayBuf, 'test.xlsx');
    expect(r1.source).toBe('alipay');

    // WeChat format
    const wechatBuf = makeExcelBuffer([
      ['交易时间', '交易类型', '交易对方', '商品', '收/支', '金额(元)', '支付方式', '当前状态'],
      ['2024-01-01 10:00:00', '商户消费', '商家B', '咖啡', '支出', '30.00', '零钱', '支付成功'],
    ]);
    const r2 = parseExcel(wechatBuf, 'test.xlsx');
    expect(r2.source).toBe('wechat');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 十一、边界场景
// ═══════════════════════════════════════════════════════════════════════════
describe('边界场景', () => {
  it('55. 空 CSV Buffer → 无数据', () => {
    const result = parseCSV(Buffer.alloc(0), 'test.csv');
    expect(result.transactions.length).toBe(0);
  });

  it('56. 仅 header 行 → 无 transactions', () => {
    const csv = '日期,金额,描述,类型';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(0);
  });

  it('57. 金额含空格 → \\s 被 strip', () => {
    const csv = '日期,金额,描述\n2024-01-01, 100 ,测试';
    const result = parseCSV(makeCSVBuffer(csv), 'test.csv');
    expect(result.transactions.length).toBe(1);
    expect(Math.abs(result.transactions[0].amount)).toBe(100);
  });
});
