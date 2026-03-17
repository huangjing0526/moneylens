'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { formatAmount } from '@/lib/utils/format';

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

export function MonthlyCompare({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#8e8e93] text-sm">
        暂无数据
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fontSize: 12, fill: '#8e8e93' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatAmount(v)}
            tick={{ fontSize: 11, fill: '#8e8e93' }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            formatter={(value, name) => [
              formatAmount(Number(value)),
              name === 'expense' ? '支出' : '收入',
            ]}
            contentStyle={{
              borderRadius: '10px',
              border: 'none',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
          />
          <Bar dataKey="expense" fill="#ff3b30" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="income" fill="#34c759" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
