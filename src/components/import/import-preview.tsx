'use client';

import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { getIcon } from '@/lib/utils/icons';
import { formatCurrency } from '@/lib/utils/format';
import type { TransactionInput, DuplicateCandidate } from '@/types';

interface ImportPreviewProps {
  source: string;
  transactions: (TransactionInput & { isDuplicate?: boolean })[];
  crossSourceDuplicates: DuplicateCandidate[];
  onConfirm: (transactions: TransactionInput[]) => void;
  onCancel: () => void;
  importing: boolean;
}

export function ImportPreview({
  source,
  transactions,
  crossSourceDuplicates,
  onConfirm,
  onCancel,
  importing,
}: ImportPreviewProps) {
  const [excluded, setExcluded] = useState<Set<number>>(() => {
    const set = new Set<number>();
    transactions.forEach((t, i) => {
      if (t.isDuplicate) set.add(i);
    });
    return set;
  });

  const toggleExclude = (index: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const included = transactions.filter((_, i) => !excluded.has(i));
  const sourceLabel = source === 'alipay' ? '支付宝' : source === 'wechat' ? '微信' : source === 'ocr' ? 'OCR' : '银行';

  // Group by date
  const grouped = new Map<string, { idx: number; t: TransactionInput & { isDuplicate?: boolean } }[]>();
  transactions.forEach((t, idx) => {
    const group = grouped.get(t.date) || [];
    group.push({ idx, t });
    grouped.set(t.date, group);
  });
  const sortedDates = Array.from(grouped.keys()).sort().reverse();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#1c1c1e]">预览导入</h3>
          <p className="text-sm text-[#8e8e93]">
            来源: {sourceLabel} · 共 {transactions.length} 条 · 将导入 {included.length} 条
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-[#8e8e93] hover:text-[#1c1c1e]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {crossSourceDuplicates.length > 0 && (
        <div className="mb-4 p-3 bg-[#ff9500]/10 rounded-xl flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#ff9500] mt-0.5 shrink-0" />
          <p className="text-sm text-[#1c1c1e]">
            发现 {crossSourceDuplicates.length} 条疑似跨源重复记录，已自动标记
          </p>
        </div>
      )}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {sortedDates.map(date => (
          <div key={date}>
            <p className="text-xs text-[#8e8e93] font-medium mb-2 sticky top-0 bg-[#f2f2f7] py-1">
              {date}
            </p>
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-50">
              {grouped.get(date)!.map(({ idx, t }) => {
                const isExcluded = excluded.has(idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-3 ${isExcluded ? 'opacity-40' : ''}`}
                  >
                    <button
                      onClick={() => toggleExclude(idx)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isExcluded
                          ? 'border-gray-300'
                          : 'border-[#007aff] bg-[#007aff]'
                      }`}
                    >
                      {!isExcluded && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1c1c1e] truncate">{t.description}</p>
                      {t.counterparty && (
                        <p className="text-xs text-[#8e8e93] truncate">{t.counterparty}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium tabular-nums ${
                        t.type === 'income' ? 'text-[#34c759]' : 'text-[#1c1c1e]'
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}
                      </p>
                      {t.category_slug && t.category_slug !== 'uncategorized' && (
                        <p className="text-[10px] text-[#8e8e93]">{t.category_slug}</p>
                      )}
                    </div>
                    {t.isDuplicate && (
                      <span className="text-[10px] text-[#ff9500] bg-[#ff9500]/10 px-1.5 py-0.5 rounded">
                        重复
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-gray-100 text-[#1c1c1e] text-sm font-medium"
        >
          取消
        </button>
        <button
          onClick={() => onConfirm(included)}
          disabled={importing || included.length === 0}
          className="flex-1 py-3 rounded-xl bg-[#007aff] text-white text-sm font-medium disabled:opacity-50"
        >
          {importing ? '导入中...' : `确认导入 ${included.length} 条`}
        </button>
      </div>
    </div>
  );
}
