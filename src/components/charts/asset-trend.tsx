'use client';

import { useId } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { formatAmount } from '@/lib/utils/format';

export interface TrendData {
  date: string;
  netWorth: number;
}

export function AssetTrend({ data }: { data: TrendData[] }) {
  const gradientId = useId();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-[#8e8e93] text-sm">
        暂无趋势数据，更新账户余额后自动生成
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#007aff" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f7" />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => {
              const parts = v.split('-');
              return `${parts[1]}/${parts[2]}`;
            }}
            tick={{ fontSize: 11, fill: '#8e8e93' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatAmount(v)}
            tick={{ fontSize: 11, fill: '#8e8e93' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip
            formatter={(value) => [formatAmount(Number(value)), '净资产']}
            labelFormatter={(label) => String(label)}
            contentStyle={{
              borderRadius: '10px',
              border: 'none',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              fontSize: '13px',
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="#007aff"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: '#007aff' }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
