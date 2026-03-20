'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react';
import { getIcon } from '@/lib/utils/icons';
import { formatCurrency, getCurrentYearMonth, getPreviousYearMonth, getMonthRange } from '@/lib/utils/format';
import type { Transaction, Category } from '@/types';
import { toast } from 'sonner';

type TimeFilter = 'all' | 'thisMonth' | 'lastMonth';

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get('category');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(urlCategory ? 'all' : 'thisMonth');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(urlCategory);
  const [search, setSearch] = useState('');
  const [expandedTx, setExpandedTx] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchTransactions = useCallback(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(page * limit));

    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);

    if (timeFilter === 'thisMonth') {
      const { start, end } = getMonthRange(getCurrentYearMonth());
      params.set('startDate', start);
      params.set('endDate', end);
    } else if (timeFilter === 'lastMonth') {
      const { start, end } = getMonthRange(getPreviousYearMonth(getCurrentYearMonth()));
      params.set('startDate', start);
      params.set('endDate', end);
    }

    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => {
        setTransactions(data.transactions);
        setTotal(data.total);
      });
  }, [timeFilter, search, page, categoryFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  }, []);

  const handleCategoryChange = async (txId: number, newSlug: string) => {
    await fetch(`/api/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_slug: newSlug }),
    });
    setExpandedTx(null);
    fetchTransactions();
    toast.success('分类已更新');
  };

  const handleDelete = async (txId: number) => {
    await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
    fetchTransactions();
    toast.success('已删除');
  };

  // Group by date
  const grouped = new Map<string, Transaction[]>();
  transactions.forEach(t => {
    const group = grouped.get(t.date) || [];
    group.push(t);
    grouped.set(t.date, group);
  });
  const dates = Array.from(grouped.keys()).sort().reverse();

  const catMap = new Map(categories.map(c => [c.slug, c]));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#1c1c1e]">账单</h1>

      {/* Time filter - Segmented control */}
      <div className="flex bg-gray-100 rounded-lg p-0.5">
        {([
          ['all', '全部'],
          ['thisMonth', '本月'],
          ['lastMonth', '上月'],
        ] as [TimeFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTimeFilter(key); setPage(0); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              timeFilter === key
                ? 'bg-white text-[#1c1c1e] shadow-sm'
                : 'text-[#8e8e93]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e93]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="搜索交易..."
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl text-sm text-[#1c1c1e] placeholder:text-[#8e8e93] outline-none"
        />
      </div>

      {/* Category filter badge */}
      {categoryFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#8e8e93]">筛选:</span>
          <button
            onClick={() => { setCategoryFilter(null); setTimeFilter('thisMonth'); setPage(0); }}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#007aff]/10 text-[#007aff] text-sm rounded-full"
          >
            {categories.find(c => c.slug === categoryFilter)?.name || categoryFilter}
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Transaction list */}
      <div className="space-y-4">
        {dates.map(date => (
          <div key={date}>
            <p className="text-xs text-[#8e8e93] font-medium mb-2">{date}</p>
            <div className="bg-white rounded-xl overflow-hidden">
              {grouped.get(date)!.map((tx, i) => {
                const cat = catMap.get(tx.category_slug);
                const Icon = getIcon(cat?.icon || 'CircleDashed');
                const color = cat?.color || '#8e8e93';

                return (
                  <div key={tx.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-[#1c1c1e] truncate">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          {tx.counterparty && (
                            <p className="text-xs text-[#8e8e93] truncate">{tx.counterparty}</p>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-[#8e8e93]">
                            {cat?.name || '未分类'}
                          </span>
                        </div>
                      </div>
                      <p className={`text-[15px] font-medium tabular-nums ${
                        tx.type === 'income' ? 'text-[#34c759]' : 'text-[#1c1c1e]'
                      }`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                      </p>
                    </div>

                    {/* Expanded action panel */}
                    {expandedTx === tx.id && (
                      <div className="px-4 pb-3 space-y-2">
                        {/* Category grid */}
                        <p className="text-xs text-[#8e8e93]">修改分类</p>
                        <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 rounded-xl">
                          {categories.map(c => {
                            const CIcon = getIcon(c.icon);
                            return (
                              <button
                                key={c.slug}
                                onClick={() => handleCategoryChange(tx.id, c.slug)}
                                className={`flex flex-col items-center gap-1 py-1.5 rounded-lg text-center ${
                                  tx.category_slug === c.slug ? 'bg-white shadow-sm' : ''
                                }`}
                              >
                                <CIcon className="w-4 h-4" style={{ color: c.color }} />
                                <span className="text-[10px] text-[#1c1c1e]">{c.name}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={() => { if (confirm('确认删除？')) handleDelete(tx.id); }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-[#ff3b30] rounded-lg active:bg-red-50 w-full"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除此记录
                        </button>
                      </div>
                    )}

                    {i < grouped.get(date)!.length - 1 && (
                      <div className="ml-16 border-b border-gray-50" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {transactions.length === 0 && (
          <div className="text-center py-16 text-[#8e8e93] text-sm">
            暂无交易记录
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 text-[#007aff] disabled:text-[#8e8e93]"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-[#8e8e93]">
            {page * limit + 1}-{Math.min((page + 1) * limit, total)} / {total}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * limit >= total}
            className="p-2 text-[#007aff] disabled:text-[#8e8e93]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
