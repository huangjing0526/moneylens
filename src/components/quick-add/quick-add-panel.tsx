'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Delete, MessageSquareText, Calculator } from 'lucide-react';
import { getIcon } from '@/lib/utils/icons';
import { parseNaturalLanguage } from '@/lib/nlp/parser';
import type { Category } from '@/types';
import type { NLPParseResult } from '@/lib/nlp/parser';

const PAYMENT_METHODS = ['支付宝', '微信支付', '银行卡', '现金', '其他'];

type InputMode = 'nlp' | 'numpad';

export function QuickAddPanel({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const [mode, setMode] = useState<InputMode>('nlp');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('food');
  const [userPickedCategory, setUserPickedCategory] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('支付宝');
  const [note, setNote] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  // NLP mode state
  const [nlpInput, setNlpInput] = useState('');
  const [nlpResult, setNlpResult] = useState<NLPParseResult | null>(null);
  const nlpInputRef = useRef<HTMLInputElement>(null);
  const prevDescRef = useRef<string>('');

  useEffect(() => {
    if (open) {
      fetch('/api/categories')
        .then(r => r.json())
        .then((cats: Category[]) => {
          setAllCategories(cats);
          setCategories(cats.filter(c => !c.is_income));
        });
    } else {
      // Reset state on close
      setAmount('');
      setNote('');
      setNlpInput('');
      setNlpResult(null);
      setSelectedCategory('food');
      setUserPickedCategory(false);
      prevDescRef.current = '';
    }
  }, [open]);

  // Auto-focus NLP input when opened in NLP mode
  useEffect(() => {
    if (open && mode === 'nlp') {
      setTimeout(() => nlpInputRef.current?.focus(), 300);
    }
  }, [open, mode]);

  // Parse NLP input in real-time
  useEffect(() => {
    if (!nlpInput.trim()) {
      setNlpResult(null);
      return;
    }
    const result = parseNaturalLanguage(nlpInput);
    setNlpResult(result);
  }, [nlpInput]);

  // Reset userPickedCategory when description changes
  useEffect(() => {
    const desc = nlpResult?.description || '';
    if (desc !== prevDescRef.current) {
      prevDescRef.current = desc;
      setUserPickedCategory(false);
    }
  }, [nlpResult?.description]);

  // Debounced auto-classify via API
  useEffect(() => {
    if (!nlpResult?.description || userPickedCategory) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: nlpResult.description, type: nlpResult.type }),
        });
        const { category_slug } = await res.json();
        if (category_slug) {
          setSelectedCategory(category_slug);
        }
      } catch {}
    }, 300);

    return () => clearTimeout(timer);
  }, [nlpResult?.description, nlpResult?.type, userPickedCategory]);

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

  const handleSave = useCallback(async () => {
    let txDate: string;
    let txTime: string;
    let txAmount: number;
    let txType: 'income' | 'expense' | 'transfer';
    let txDescription: string;
    let txCategory: string;

    if (mode === 'nlp' && nlpResult) {
      txAmount = nlpResult.type === 'expense' ? -nlpResult.amount : (nlpResult.type === 'transfer' ? -nlpResult.amount : nlpResult.amount);
      txType = nlpResult.type;
      txDate = nlpResult.date;
      const now = new Date();
      txTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
      txDescription = nlpResult.description || nlpInput.replace(/[\d¥￥.元块]/g, '').trim() || (txType === 'income' ? '收入' : '支出');
      // Use auto-classified or user-picked category; empty string triggers backend classify
      txCategory = selectedCategory === 'uncategorized' && !userPickedCategory ? '' : selectedCategory;
    } else {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return;
      txAmount = -num;
      txType = 'expense';
      const today = new Date();
      txDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      txTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}:00`;
      txDescription = note || categories.find(c => c.slug === selectedCategory)?.name || '支出';
      txCategory = selectedCategory;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: [{
            source: 'manual',
            date: txDate,
            time: txTime,
            amount: txAmount,
            type: txType,
            description: txDescription,
            category_slug: txCategory,
            payment_method: paymentMethod,
            note: mode === 'nlp' ? '' : note,
          }],
          // Learn user's category pick for future auto-classification
          learn: (mode === 'nlp' && userPickedCategory && nlpResult?.description)
            ? { keyword: nlpResult.description, category_slug: selectedCategory }
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        alert(`保存失败: ${err}`);
        return;
      }

      setAmount('');
      setNote('');
      setNlpInput('');
      setNlpResult(null);
      onClose();
      onSaved?.();
    } catch (e) {
      alert(`保存失败: ${e instanceof Error ? e.message : '网络错误'}`);
    } finally {
      setSaving(false);
    }
  }, [mode, nlpResult, nlpInput, amount, note, selectedCategory, userPickedCategory, paymentMethod, categories, onClose, onSaved]);

  const canSave = mode === 'nlp' ? !!nlpResult : !!amount;

  // Find the matched category for preview display
  const matchedCategory = allCategories.find(c => c.slug === selectedCategory);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-lg font-semibold text-[#1c1c1e]">记一笔</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(mode === 'nlp' ? 'numpad' : 'nlp')}
              className="p-1.5 rounded-lg bg-gray-100 text-[#8e8e93] active:bg-gray-200"
              title={mode === 'nlp' ? '切换到数字键盘' : '切换到智能输入'}
            >
              {mode === 'nlp' ? <Calculator className="w-4 h-4" /> : <MessageSquareText className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1 text-[#8e8e93]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mode === 'nlp' ? (
          /* ===== NLP Mode ===== */
          <div className="px-5 pb-[env(safe-area-inset-bottom)]">
            {/* Input */}
            <div className="mb-4">
              <input
                ref={nlpInputRef}
                type="text"
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSave) handleSave(); }}
                placeholder="试试输入：午饭 35、昨天打车 28、发工资 15000"
                className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-base text-[#1c1c1e] placeholder:text-[#c7c7cc] outline-none focus:bg-gray-100 focus:ring-2 focus:ring-[#007aff]/20 transition-all"
              />
            </div>

            {/* Preview parsed result */}
            {nlpResult && (
              <div className="mb-4 px-4 py-3 bg-gray-50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8e8e93]">金额</span>
                  <span className={`text-xl font-semibold ${nlpResult.type === 'income' ? 'text-green-600' : nlpResult.type === 'transfer' ? 'text-[#007aff]' : 'text-[#1c1c1e]'}`}>
                    {nlpResult.type === 'income' ? '+' : '-'}¥{nlpResult.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8e8e93]">日期</span>
                  <span className="text-sm text-[#1c1c1e]">{nlpResult.date}</span>
                </div>
                {nlpResult.description && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8e8e93]">描述</span>
                    <span className="text-sm text-[#1c1c1e]">{nlpResult.description}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#8e8e93]">类型</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    nlpResult.type === 'income' ? 'bg-green-100 text-green-700' : nlpResult.type === 'transfer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {nlpResult.type === 'income' ? '收入' : nlpResult.type === 'transfer' ? '转账' : '支出'}
                  </span>
                </div>
                {/* Show auto-classified category */}
                {matchedCategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#8e8e93]">分类</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${matchedCategory.color}20` }}
                      >
                        {(() => { const Icon = getIcon(matchedCategory.icon); return <Icon className="w-3 h-3" style={{ color: matchedCategory.color }} />; })()}
                      </div>
                      <span className="text-sm text-[#1c1c1e]">{matchedCategory.name}</span>
                      {userPickedCategory && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">手选</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Category grid (for NLP mode, allow override) */}
            <div className="mb-3">
              <div className="grid grid-cols-5 gap-2">
                {(nlpResult?.type === 'income'
                  ? allCategories.filter(c => c.is_income)
                  : nlpResult?.type === 'transfer'
                    ? allCategories.filter(c => ['transfer', 'transfer_self'].includes(c.slug))
                    : categories
                ).slice(0, 10).map(cat => {
                  const Icon = getIcon(cat.icon);
                  const isSelected = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => { setSelectedCategory(cat.slug); setUserPickedCategory(true); }}
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
            <div className="mb-4 flex gap-2">
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

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || !canSave}
              className="w-full py-3.5 rounded-2xl bg-[#007aff] text-white font-semibold text-base active:bg-[#0066d6] disabled:opacity-40 transition-all mb-4"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        ) : (
          /* ===== Numpad Mode (original) ===== */
          <>
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
                if (key === null) return null;
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
          </>
        )}
      </div>
    </div>
  );
}
