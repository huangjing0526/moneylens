'use client';

import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subMonths, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils/format';

interface HeatmapData {
  date: string;
  amount: number;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getIntensity(amount: number, max: number): string {
  if (amount === 0) return 'bg-gray-100';
  const ratio = amount / max;
  if (ratio < 0.25) return 'bg-red-100';
  if (ratio < 0.5) return 'bg-red-200';
  if (ratio < 0.75) return 'bg-red-300';
  return 'bg-red-400';
}

export function ExpenseHeatmap({ data, months = 3 }: { data: HeatmapData[]; months?: number }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { weeks, maxAmount, dataMap } = useMemo(() => {
    const map = new Map<string, number>();
    let max = 0;
    for (const d of data) {
      map.set(d.date, d.amount);
      if (d.amount > max) max = d.amount;
    }

    const end = new Date();
    const start = subMonths(end, months);
    const weekStart = startOfWeek(start, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(end, { weekStartsOn: 1 });

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weeksList: string[][] = [];
    let currentWeek: string[] = [];

    for (const day of days) {
      const dayStr = format(day, 'yyyy-MM-dd');
      currentWeek.push(dayStr);
      if (currentWeek.length === 7) {
        weeksList.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeksList.push(currentWeek);

    return { weeks: weeksList, maxAmount: max || 1, dataMap: map };
  }, [data, months]);

  const selectedAmount = selectedDate ? dataMap.get(selectedDate) : undefined;

  return (
    <div>
      {selectedDate && (
        <div className="text-center mb-3 text-sm text-[#8e8e93]">
          {selectedDate} · {selectedAmount ? formatCurrency(selectedAmount) : '无消费'}
        </div>
      )}
      <div className="flex gap-0.5">
        <div className="flex flex-col gap-0.5 mr-1.5 pt-0">
          {WEEKDAYS.map(d => (
            <div key={d} className="h-3 w-6 text-[9px] text-[#8e8e93] flex items-center justify-end leading-none">
              {['周一', '周三', '周五', '周日'].includes(d) ? d : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-0.5 overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => {
                const amount = dataMap.get(day) || 0;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                    className={`w-3 h-3 rounded-[2px] transition-colors ${getIntensity(amount, maxAmount)} ${
                      day === selectedDate ? 'ring-1 ring-[#007aff]' : ''
                    }`}
                    title={`${day}: ${formatCurrency(amount)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[10px] text-[#8e8e93]">少</span>
        <div className="w-3 h-3 rounded-[2px] bg-gray-100" />
        <div className="w-3 h-3 rounded-[2px] bg-red-100" />
        <div className="w-3 h-3 rounded-[2px] bg-red-200" />
        <div className="w-3 h-3 rounded-[2px] bg-red-300" />
        <div className="w-3 h-3 rounded-[2px] bg-red-400" />
        <span className="text-[10px] text-[#8e8e93]">多</span>
      </div>
    </div>
  );
}
