'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Repeat, CreditCard, RefreshCw, ChevronRight } from 'lucide-react';
import { CategoryBar } from '@/components/charts/category-bar';
import { TrendLine } from '@/components/charts/trend-line';
import { ExpenseHeatmap } from '@/components/charts/heatmap';
import { getIcon } from '@/lib/utils/icons';
import { formatCurrency, formatAmount, getCurrentYearMonth } from '@/lib/utils/format';
import Link from 'next/link';

export default function DashboardPage() {
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    byCategory: { slug: string; name: string; icon: string; color: string; amount: number }[];
    excludedSummary: { slug: string; name: string; icon: string; color: string; amount: number }[];
    changePercent: string | null;
  } | null>(null);
  const [trend, setTrend] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [heatmap, setHeatmap] = useState<{ date: string; amount: number }[]>([]);
  const [heatmapRange, setHeatmapRange] = useState(3); // months
  const [recurring, setRecurring] = useState<{
    recurring: { description: string; averageAmount: number; category_slug: string }[];
    totalMonthly: number;
  } | null>(null);

  useEffect(() => {
    const month = getCurrentYearMonth();
    fetch(`/api/reports?month=${month}`).then(r => r.json()).then(setSummary);
    fetch('/api/reports?type=trend&months=6').then(r => r.json()).then(setTrend);
    fetch('/api/reports/recurring').then(r => r.json()).then(setRecurring);
  }, []);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - heatmapRange, 1);
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    fetch(`/api/reports?type=heatmap&startDate=${startDate}&endDate=${endDate}`).then(r => r.json()).then(setHeatmap);
  }, [heatmapRange]);

  const change = summary?.changePercent ? parseFloat(summary.changePercent) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#1c1c1e]">概览</h1>

      {/* Heatmap */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-[#8e8e93]">消费热力图</h2>
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {([
              [1, '1月'],
              [3, '3月'],
              [6, '半年'],
              [12, '1年'],
            ] as [number, string][]).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setHeatmapRange(m)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  heatmapRange === m
                    ? 'bg-white text-[#1c1c1e] shadow-sm'
                    : 'text-[#8e8e93]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ExpenseHeatmap data={heatmap} months={heatmapRange} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4">
          <p className="text-[13px] text-[#8e8e93] mb-1">本月支出</p>
          <p className="text-2xl font-semibold text-[#1c1c1e] tabular-nums">
            {summary ? formatAmount(summary.totalExpense) : '—'}
          </p>
          {change !== null && (
            <div className={`flex items-center gap-1 mt-1 ${change > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
              {change > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span className="text-xs font-medium">{Math.abs(change)}%</span>
              <span className="text-xs text-[#8e8e93]">vs 上月</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl p-4">
          <p className="text-[13px] text-[#8e8e93] mb-1">本月收入</p>
          <p className="text-2xl font-semibold text-[#34c759] tabular-nums">
            {summary ? formatAmount(summary.totalIncome) : '—'}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-sm font-medium text-[#8e8e93] mb-3">分类消费</h2>
        {summary ? (
          <CategoryBar data={summary.byCategory} />
        ) : (
          <div className="h-32 flex items-center justify-center text-[#8e8e93] text-sm">加载中...</div>
        )}
      </div>

      {/* Excluded from stats: credit card & internal transfers */}
      {summary && summary.excludedSummary && summary.excludedSummary.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <h2 className="text-sm font-medium text-[#8e8e93] mb-3">不计入收支</h2>
          <div className="space-y-2">
            {summary.excludedSummary.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <Link
                  key={item.slug}
                  href={`/transactions?category=${item.slug}`}
                  className="flex items-center gap-3 py-1 group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-sm text-[#1c1c1e] flex-1">{item.name}</span>
                  <span className="text-sm text-[#8e8e93] tabular-nums">
                    {formatCurrency(item.amount)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#c7c7cc] group-hover:text-[#8e8e93]" />
                </Link>
              );
            })}
          </div>
          <p className="text-[11px] text-[#8e8e93] mt-2">
            信用卡还款和内部转账不重复计入收支统计
          </p>
        </div>
      )}

      {/* Recurring expenses */}
      {recurring && recurring.recurring.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Repeat className="w-4 h-4 text-[#8e8e93]" />
            <h2 className="text-sm font-medium text-[#8e8e93]">固定支出</h2>
            <span className="ml-auto text-sm font-semibold text-[#ff3b30] tabular-nums">
              {formatCurrency(recurring.totalMonthly)}/月
            </span>
          </div>
          <div className="space-y-2">
            {recurring.recurring.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-[#1c1c1e]">{item.description}</span>
                <span className="text-sm text-[#8e8e93] tabular-nums">
                  {formatCurrency(item.averageAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend */}
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-sm font-medium text-[#8e8e93] mb-3">近6个月趋势</h2>
        <TrendLine data={trend} />
      </div>
    </div>
  );
}
