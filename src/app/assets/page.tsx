'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Check, Trash2 } from 'lucide-react';
import { getIcon } from '@/lib/utils/icons';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import type { Account, AccountType, AssetSummary } from '@/types';
import { ACCOUNT_TYPE_LABELS } from '@/types';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'debit_card', 'credit_card', 'investment', 'ebank', 'other'];

const TYPE_DEFAULTS: Record<AccountType, { icon: string; color: string }> = {
  cash: { icon: 'Banknote', color: '#34c759' },
  debit_card: { icon: 'CreditCard', color: '#007aff' },
  credit_card: { icon: 'CreditCard', color: '#ff3b30' },
  investment: { icon: 'TrendingUp', color: '#af52de' },
  ebank: { icon: 'Wallet', color: '#ff9500' },
  other: { icon: 'CircleDollarSign', color: '#8e8e93' },
};

export default function AssetsPage() {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [editingBalance, setEditingBalance] = useState<number | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', type: 'debit_card' as AccountType, institution: '', balance: '' });

  const fetchSummary = () => {
    fetch('/api/assets/summary').then(r => r.json()).then(setSummary);
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleUpdateBalance = async (id: number) => {
    const balance = parseFloat(balanceInput);
    if (isNaN(balance)) { toast.error('请输入有效金额'); return; }

    await fetch(`/api/assets/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance }),
    });
    setEditingBalance(null);
    setBalanceInput('');
    fetchSummary();
    toast.success('余额已更新');
  };

  const handleAdd = async () => {
    if (!newAccount.name) { toast.error('请输入账户名称'); return; }
    const balance = newAccount.balance ? parseFloat(newAccount.balance) : 0;
    const defaults = TYPE_DEFAULTS[newAccount.type];

    await fetch('/api/assets/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAccount.name,
        type: newAccount.type,
        icon: defaults.icon,
        color: defaults.color,
        balance,
        institution: newAccount.institution || null,
      }),
    });
    setAdding(false);
    setNewAccount({ name: '', type: 'debit_card', institution: '', balance: '' });
    fetchSummary();
    toast.success('账户已添加');
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确认删除「${name}」？历史快照也会删除。`)) return;
    await fetch(`/api/assets/accounts/${id}`, { method: 'DELETE' });
    fetchSummary();
    toast.success('账户已删除');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1c1c1e]">我的资产</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#007aff] active:bg-[#007aff]/5 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          添加账户
        </button>
      </div>

      {/* Net Worth Card */}
      {summary && (
        <div className="bg-gradient-to-br from-[#007aff] to-[#5856d6] text-white rounded-2xl p-5">
          <p className="text-sm opacity-80 mb-1">净资产</p>
          <p className="text-3xl font-bold tabular-nums">
            ¥{summary.netWorth.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex gap-6 mt-3 text-sm opacity-80">
            <div>
              <span>总资产 </span>
              <span className="font-medium text-white">¥{summary.totalAssets.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div>
              <span>总负债 </span>
              <span className="font-medium text-white">¥{summary.totalLiabilities.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Add account form */}
      {adding && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#1c1c1e]">添加账户</p>
          <input
            value={newAccount.name}
            onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
            placeholder="账户名称（如：招商银行储蓄卡）"
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={newAccount.type}
              onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as AccountType })}
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              value={newAccount.balance}
              onChange={(e) => setNewAccount({ ...newAccount, balance: e.target.value })}
              placeholder="当前余额"
              type="number"
              step="0.01"
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
            />
          </div>
          <input
            value={newAccount.institution}
            onChange={(e) => setNewAccount({ ...newAccount, institution: e.target.value })}
            placeholder="所属机构（可选，如：招商银行）"
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
          />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2.5 text-sm text-[#8e8e93] bg-gray-100 rounded-xl active:bg-gray-200">
              取消
            </button>
            <button onClick={handleAdd} className="flex-1 py-2.5 text-sm text-white bg-[#007aff] rounded-xl active:bg-[#0066d6]">
              添加
            </button>
          </div>
        </div>
      )}

      {/* Account groups */}
      {summary && ACCOUNT_TYPES.map(type => {
        const accounts = summary.accountsByType[type];
        if (!accounts || accounts.length === 0) return null;

        const groupTotal = accounts.reduce((sum, a) => sum + a.balance, 0);

        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[#8e8e93] font-medium">{ACCOUNT_TYPE_LABELS[type]}</p>
              <p className={`text-xs font-medium tabular-nums ${groupTotal < 0 ? 'text-[#ff3b30]' : 'text-[#8e8e93]'}`}>
                {formatCurrency(groupTotal)}
              </p>
            </div>
            <div className="bg-white rounded-xl overflow-hidden">
              {accounts.map((acc, i) => {
                const Icon = getIcon(acc.icon);
                const isEditing = editingBalance === acc.id;

                return (
                  <div key={acc.id}>
                    <div
                      className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (isEditing) return;
                        setEditingBalance(acc.id);
                        setBalanceInput(String(acc.balance));
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${acc.color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: acc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-[#1c1c1e]">{acc.name}</p>
                        {acc.institution && (
                          <p className="text-xs text-[#8e8e93]">{acc.institution}</p>
                        )}
                      </div>
                      <p className={`text-[15px] font-medium tabular-nums ${acc.balance < 0 ? 'text-[#ff3b30]' : 'text-[#1c1c1e]'}`}>
                        {formatCurrency(acc.balance)}
                      </p>
                    </div>

                    {/* Inline balance edit */}
                    {isEditing && (
                      <div className="px-4 pb-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={balanceInput}
                            onChange={(e) => setBalanceInput(e.target.value)}
                            type="number"
                            step="0.01"
                            className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateBalance(acc.id); }}
                          />
                          <button
                            onClick={() => handleUpdateBalance(acc.id)}
                            className="px-3 py-2 bg-[#007aff] text-white rounded-xl active:bg-[#0066d6]"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingBalance(null); setBalanceInput(''); }}
                            className="px-3 py-2 bg-gray-100 text-[#8e8e93] rounded-xl active:bg-gray-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleDelete(acc.id, acc.name)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-[#ff3b30] rounded-lg active:bg-red-50 w-full"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除账户
                        </button>
                      </div>
                    )}

                    {i < accounts.length - 1 && <div className="ml-16 border-b border-gray-50" />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {summary && Object.values(summary.accountsByType).every(arr => !arr || arr.length === 0) && !adding && (
        <div className="text-center py-16 text-[#8e8e93] text-sm">
          暂无账户，点击右上角添加
        </div>
      )}
    </div>
  );
}
