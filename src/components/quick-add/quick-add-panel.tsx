'use client';

import { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';
import { getIcon } from '@/lib/utils/icons';
import type { Category } from '@/types';

const PAYMENT_METHODS = ['支付宝', '微信支付', '银行卡', '现金', '其他'];

export function QuickAddPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [paymentMethod, setPaymentMethod] = useState('支付宝');
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetch('/api/categories')
        .then(r => r.json())
        .then((cats: Category[]) => setCategories(cats.filter(c => !c.is_income)));
    }
  }, [open]);

  const handleKeyPress = (key: string) => {
    if (key === 'delete') {
      setAmount(a => a.slice(0, -1));
    } else if (key === '.') {
      if (!amount.includes('.')) setAmount(a => a + '.');
    } else {
      if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
      setAmount(a => a + key);
    }
  };

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    setSaving(true);
    try {
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const time = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: [{
            source: 'manual',
            date,
            time,
            amount: -num,
            type: 'expense',
            description: note || categories.find(c => c.slug === selectedCategory)?.name || '支出',
            category_slug: selectedCategory,
            payment_method: paymentMethod,
            note,
          }],
        }),
      });

      setAmount('');
      setNote('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-lg font-semibold text-[#1c1c1e]">记一笔</h3>
          <button onClick={onClose} className="p-1 text-[#8e8e93]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount display */}
        <div className="px-5 pb-4">
          <div className="text-4xl font-light text-[#1c1c1e] text-center py-4">
            <span className="text-xl text-[#8e8e93]">¥</span>
            {amount || '0.00'}
          </div>
        </div>

        {/* Category grid */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-5 gap-2">
            {categories.slice(0, 10).map(cat => {
              const Icon = getIcon(cat.icon);
              const isSelected = selectedCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                    isSelected ? 'bg-gray-100' : ''
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: isSelected ? cat.color : `${cat.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: isSelected ? 'white' : cat.color }} />
                  </div>
                  <span className="text-[11px] text-[#1c1c1e]">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment method */}
        <div className="px-5 pb-3 flex gap-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                paymentMethod === m
                  ? 'bg-[#007aff] text-white'
                  : 'bg-gray-100 text-[#8e8e93]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Note input */}
        <div className="px-5 pb-3">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注..."
            className="w-full px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-[#1c1c1e] placeholder:text-[#8e8e93] outline-none focus:bg-gray-100 transition-colors"
          />
        </div>

        {/* Number pad */}
        <div className="grid grid-cols-4 gap-px bg-gray-200 pb-[env(safe-area-inset-bottom)]">
          {['1', '2', '3', 'delete', '4', '5', '6', 'done', '7', '8', '9', null, '0', '.', null, null].map((key, i) => {
            if (key === null) return null; // skip cells occupied by "done" span
            if (key === 'done') {
              return (
                <button
                  key="done"
                  onClick={handleSave}
                  disabled={saving || !amount}
                  className="bg-[#007aff] text-white text-sm font-semibold active:bg-[#0066d6] disabled:opacity-50"
                  style={{ gridRow: '2 / 5', gridColumn: '4' }}
                >
                  {saving ? '...' : '完成'}
                </button>
              );
            }
            if (key === 'delete') {
              return (
                <button
                  key="delete"
                  onClick={() => handleKeyPress('delete')}
                  className="bg-gray-50 py-3 flex items-center justify-center active:bg-gray-200"
                >
                  <Delete className="w-5 h-5 text-[#1c1c1e]" />
                </button>
              );
            }
            return (
              <button
                key={`key-${key}-${i}`}
                onClick={() => handleKeyPress(key)}
                className="bg-white py-3 text-lg text-[#1c1c1e] active:bg-gray-100 font-medium"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
