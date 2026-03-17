import { NextRequest, NextResponse } from 'next/server';
import { getMonthlySummary, getMonthlyTrend, getDailyExpenseHeatmap } from '@/lib/db/queries';
import { getCurrentYearMonth, getPreviousYearMonth } from '@/lib/utils/format';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const month = params.get('month') || getCurrentYearMonth();
  const type = params.get('type') || 'summary';

  if (type === 'trend') {
    const months = parseInt(params.get('months') || '6');
    const trend = await getMonthlyTrend(months);
    return NextResponse.json(trend);
  }

  if (type === 'heatmap') {
    const startDate = params.get('startDate') || `${month}-01`;
    const endDate = params.get('endDate') || `${month}-31`;
    const data = await getDailyExpenseHeatmap(startDate, endDate);
    return NextResponse.json(data);
  }

  const current = await getMonthlySummary(month);
  const prevMonth = getPreviousYearMonth(month);
  const previous = await getMonthlySummary(prevMonth);

  const changePercent = previous.totalExpense > 0
    ? ((current.totalExpense - previous.totalExpense) / previous.totalExpense * 100).toFixed(1)
    : null;

  return NextResponse.json({
    month,
    ...current,
    previousExpense: previous.totalExpense,
    changePercent,
  });
}
