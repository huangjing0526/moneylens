import type { TransactionInput } from '@/types';

// Any of these headers appearing means it's likely an Alipay export
const ALIPAY_HEADERS = [
  '交易号', '交易订单号', '商家订单号',
  '交易创建时间', '付款时间',
  '交易金额', '金额（元）',
  '交易状态',
];

export function isAlipayCSV(headers: string[]): boolean {
  const cleaned = headers.map(h => h.trim().replace(/\t/g, ''));
  // Match if at least 2 of the known headers are present
  const matchCount = ALIPAY_HEADERS.filter(h => cleaned.includes(h)).length;
  if (matchCount >= 2) return true;
  // Also match if it has both 收/支 and 商家订单号 or 交易对方+金额+交易状态
  const has = (h: string) => cleaned.includes(h);
  return (has('商家订单号') && has('收/支')) ||
         (has('交易对方') && has('交易状态') && (has('金额') || has('交易金额')));
}

export function parseAlipayCSV(rows: Record<string, string>[]): TransactionInput[] {
  const transactions: TransactionInput[] = [];

  for (const row of rows) {
    // Flexible column lookup: try multiple possible column names
    const clean = (...keys: string[]) => {
      for (const key of keys) {
        const val = Object.entries(row).find(([k]) => k.trim().replace(/\t/g, '') === key);
        if (val && val[1]?.trim()) return val[1].trim().replace(/\t/g, '');
      }
      return '';
    };

    const status = clean('交易状态');
    if (status === '交易关闭' || status === '关闭') continue;

    const amountStr = clean('交易金额', '金额（元）', '金额').replace(/[¥￥,\s]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    const incomeExpense = clean('收/支');
    const desc = clean('商品说明', '商品名称', '交易说明', '交易分类');
    const isRefund = status.includes('退款') || clean('交易分类').includes('退款') || desc.includes('退款');
    const isIncome = incomeExpense === '收入' || incomeExpense === '已收入' || isRefund;

    const dateTimeStr = clean('交易创建时间', '付款时间', '交易时间');
    if (!dateTimeStr) continue;
    const [datePart, timePart] = dateTimeStr.split(' ');
    const date = datePart?.replace(/\//g, '-') || '';
    if (!date) continue;

    transactions.push({
      source: 'alipay',
      source_id: clean('交易号', '交易订单号') || null,
      date,
      time: timePart || null,
      amount: isIncome ? amount : -amount,
      type: isIncome ? 'income' : 'expense',
      description: clean('商品说明', '商品名称', '交易说明', '交易分类') || '',
      counterparty: clean('交易对方') || null,
      payment_method: clean('收/付款方式', '收/付款方式 ') || '支付宝',
      note: clean('备注') || undefined,
    });
  }

  return transactions;
}
