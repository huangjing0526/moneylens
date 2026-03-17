'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils/format';

interface CategoryData {
  slug: string;
  name: string;
  color: string;
  amount: number;
}

export function CategoryPie({ data }: { data: CategoryData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#8e8e93] text-sm">
        暂无数据
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="w-40 h-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.slug} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                fontSize: '13px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.slice(0, 5).map((item) => (
          <div key={item.slug} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-[#1c1c1e] flex-1">{item.name}</span>
            <span className="text-sm text-[#8e8e93] tabular-nums">
              {((item.amount / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
