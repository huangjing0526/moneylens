export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  return `${amount < 0 ? '-' : ''}¥${abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    return `¥${(abs / 10000).toFixed(1)}万`;
  }
  return `¥${abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getMonthRange(yearMonth: string): { start: string; end: string } {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}
