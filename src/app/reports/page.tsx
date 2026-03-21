'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { CategoryBar } from '@/components/charts/category-bar';
import { MonthlyCompare } from '@/components/charts/monthly-compare';
import { CategoryPie } from '@/components/charts/category-pie';
import { getIcon } from '@/lib/utils/icons';
import { formatCurrency, formatAmount, getCurrentYearMonth, getPreviousYearMonth, getMonthRange } from '@/lib/utils/format';
import type { Transaction } from '@/types';

export default function ReportsPage() {
  const [month, setMonth] = useState(getCurrentYearMonth());
  const [summary, setSummary] = useState<{
    totalIncome: number;
    totalExpense: number;
    byCategory: { slug: string; name: string; icon: string; color: string; amount: number }[];
    excludedSummary: { slug: string; name: string; icon: string; color: string; amount: number }[];
    previousExpense: number;
    changePercent: string | null;
  } | null>(null);
  const [trend, setTrend] = useState<{ month: string; income: number; expense: number }[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reports?month=${month}`).then(r => r.json()).then(setSummary);
    fetch('/api/reports?type=trend&months=6').then(r => r.json()).then(setTrend);

    // Fetch all transactions for this month
    const { start, end } = getMonthRange(month);
    fetch(`/api/transactions?startDate=${start}&endDate=${end}&limit=1000`)
      .then(r => r.json())
      .then(data => setTransactions(data.transactions));
  }, [month]);

  const prevMonth = () => setMonth(getPreviousYearMonth(month));
  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    if (next <= getCurrentYearMonth()) setMonth(next);
  };

  const toggleCategory = (slug: string) => {
    setExpandedCategory(expandedCategory === slug ? null : slug);
  };

  // Group transactions by category
  const txByCategory = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    const list = txByCategory.get(tx.category_slug) || [];
    list.push(tx);
    txByCategory.set(tx.category_slug, list);
  });

  const [year, mon] = month.split('-');

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1c1c1e]">月度报告</h1>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-1 text-[#007aff]">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-[#1c1c1e] min-w-[80px] text-center">
            {year}年{parseInt(mon)}月
          </span>
          <button
            onClick={nextMonth}
            disabled={month >= getCurrentYearMonth()}
            className="p-1 text-[#007aff] disabled:text-[#8e8e93]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4">
          <p className="text-[13px] text-[#8e8e93] mb-1">支出</p>
          <p className="text-xl font-semibold text-[#1c1c1e] tabular-nums">
            {summary ? formatAmount(summary.totalExpense) : '—'}
          </p>
          {summary?.changePercent && (
            <p className={`text-xs mt-1 ${
              parseFloat(summary.changePercent) > 0 ? 'text-[#ff3b30]' : 'text-[#34c759]'
            }`}>
              vs 上月 {parseFloat(summary.changePercent) > 0 ? '+' : ''}{summary.changePercent}%
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl p-4">
          <p className="text-[13px] text-[#8e8e93] mb-1">收入</p>
          <p className="text-xl font-semibold text-[#34c759] tabular-nums">
            {summary ? formatAmount(summary.totalIncome) : '—'}
          </p>
          {summary && (
            <p className="text-xs mt-1 text-[#8e8e93]">
              结余 {formatCurrency(summary.totalIncome - summary.totalExpense)}
            </p>
          )}
        </div>
      </div>

      {/* Pie chart */}
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-sm font-medium text-[#8e8e93] mb-3">分类占比</h2>
        {summary ? <CategoryPie data={summary.byCategory} /> : null}
      </div>

      {/* Category ranking with expandable transaction details */}
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-sm font-medium text-[#8e8e93] mb-3">分类排行</h2>
        {summary && summary.byCategory.length > 0 ? (
          <div className="space-y-1">
            {summary.byCategory.map((cat) => {
              const Icon = getIcon(cat.icon);
              const maxAmount = Math.max(...summary.byCategory.map(d => d.amount));
              const percent = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0;
              const isExpanded = expandedCategory === cat.slug;
              const catTxs = txByCategory.get(cat.slug) || [];

              return (
                <div key={cat.slug}>
                  <button
                    onClick={() => toggleCategory(cat.slug)}
                    className="flex items-center gap-3 w-full py-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[#1c1c1e]">{cat.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-[#1c1c1e] tabular-nums font-medium">
                            {formatCurrency(cat.amount)}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-[#8e8e93]" />
                            : <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93]" />
                          }
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  </button>

                  {/* Expanded transaction list */}
                  {isExpanded && catTxs.length > 0 && (
                    <div className="ml-11 mt-1 mb-2 border-l-2 border-gray-100 pl-3 space-y-0">
                      {catTxs
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(tx => (
                          <div key={tx.id} className="flex items-center justify-between py-1.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[#1c1c1e] truncate">{tx.description}</p>
                              <p className="text-[11px] text-[#8e8e93]">{tx.date}</p>
                            </div>
                            <span className={`text-[13px] tabular-nums shrink-0 ml-2 ${
                              tx.type === 'income' ? 'text-[#34c759]' : tx.type === 'transfer' ? 'text-[#007aff]' : 'text-[#1c1c1e]'
                            }`}>
                              {tx.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-[#8e8e93] text-sm">暂无数据</div>
        )}
      </div>

      {/* Excluded from stats */}
      {summary && summary.excludedSummary && summary.excludedSummary.length > 0 && (
        <div className="bg-white rounded-xl p-4">
          <h2 className="text-sm font-medium text-[#8e8e93] mb-3">不计入收支</h2>
          <div className="space-y-1">
            {summary.excludedSummary.map((item) => {
              const Icon = getIcon(item.icon);
              const isExpanded = expandedCategory === item.slug;
              const catTxs = txByCategory.get(item.slug) || [];

              return (
                <div key={item.slug}>
                  <button
                    onClick={() => toggleCategory(item.slug)}
                    className="flex items-center gap-3 w-full py-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <span className="text-sm text-[#1c1c1e] flex-1 text-left">{item.name}</span>
                    <span className="text-sm text-[#8e8e93] tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                    {isExpanded
                      ? <ChevronUp className="w-3.5 h-3.5 text-[#8e8e93]" />
                      : <ChevronDown className="w-3.5 h-3.5 text-[#8e8e93]" />
                    }
                  </button>
                  {isExpanded && catTxs.length > 0 && (
                    <div className="ml-11 mt-1 mb-2 border-l-2 border-gray-100 pl-3">
                      {catTxs
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(tx => (
                          <div key={tx.id} className="flex items-center justify-between py-1.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-[#1c1c1e] truncate">{tx.description}</p>
                              <p className="text-[11px] text-[#8e8e93]">{tx.date}</p>
                            </div>
                            <span className={`text-[13px] tabular-nums shrink-0 ml-2 ${
                              tx.amount > 0 ? 'text-[#34c759]' : 'text-[#8e8e93]'
                            }`}>
                              {tx.amount > 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#8e8e93] mt-2">
            信用卡还款和内部转账不重复计入收支统计
          </p>
        </div>
      )}

      {/* Monthly compare */}
      <div className="bg-white rounded-xl p-4">
        <h2 className="text-sm font-medium text-[#8e8e93] mb-3">月度对比</h2>
        <MonthlyCompare data={trend} />
      </div>
    </div>
  );
}
