'use client';

import { getIcon } from '@/lib/utils/icons';
import { formatCurrency } from '@/lib/utils/format';

interface CategoryData {
  slug: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export function CategoryBar({ data }: { data: CategoryData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[#8e8e93] text-sm">
        暂无数据
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount));

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const Icon = getIcon(item.icon);
        const percent = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;

        return (
          <div key={item.slug} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${item.color}15` }}
            >
              <Icon className="w-4 h-4" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-[#1c1c1e]">{item.name}</span>
                <span className="text-sm text-[#1c1c1e] tabular-nums font-medium">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
