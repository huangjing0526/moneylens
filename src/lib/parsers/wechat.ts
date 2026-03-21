import type { TransactionInput } from '@/types';

export function isWechatCSV(headers: string[]): boolean {
  const cleaned = headers.map(h => h.trim().replace(/\t/g, ''));
  const has = (h: string) => cleaned.includes(h);

  // WeChat exports have: 交易时间, 交易类型, 交易对方, 商品, 收/支, 金额(元)
  // Distinguish from Alipay: WeChat has "商品" + "交易类型" columns, Alipay has "商品说明" + "交易分类"
  // Also WeChat has "金额(元)" while Alipay uses "金额" or "交易金额"
  if (has('商品') && has('交易对方') && has('收/支')) return true;
  if (has('金额(元)') && has('交易对方')) return true;
  if (has('交易类型') && has('商品') && has('收/支')) return true;

  return false;
}

export function parseWechatCSV(rows: Record<string, string>[]): TransactionInput[] {
  const transactions: TransactionInput[] = [];

  for (const row of rows) {
    const clean = (...keys: string[]) => {
      for (const key of keys) {
        const val = Object.entries(row).find(([k]) => k.trim().replace(/\t/g, '') === key);
        if (val && val[1]?.trim()) return val[1].trim().replace(/\t/g, '');
      }
      return '';
    };

    const status = clean('当前状态');

    const amountStr = clean('金额(元)', '金额').replace(/[¥￥,\s]/g, '');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount === 0) continue;

    const incomeExpense = clean('收/支');
    // "已退款"状态的记录应该算收入（钱退回来了），不跳过
    const isRefund = status === '已退款' || status.includes('退款');
    // 空字符串跳过；'/' 在微信中表示转账，保留为 transfer 类型
    if (!isRefund && incomeExpense === '') continue;
    const isTransfer = !isRefund && incomeExpense === '/';
    const isIncome = !isTransfer && (incomeExpense === '收入' || isRefund);

    const dateTimeStr = clean('交易时间');
    if (!dateTimeStr) continue;
    const [datePart, timePart] = dateTimeStr.split(' ');
    const date = datePart?.replace(/\//g, '-') || '';
    if (!date) continue;

    transactions.push({
      source: 'wechat',
      source_id: clean('交易单号') || null,
      date,
      time: timePart || null,
      amount: isTransfer ? amount : (isIncome ? amount : -amount),
      type: isTransfer ? 'transfer' : (isIncome ? 'income' : 'expense'),
      description: clean('商品', '交易类型') || '',
      counterparty: clean('交易对方') || null,
      payment_method: clean('支付方式') || '微信支付',
    });
  }

  return transactions;
}
