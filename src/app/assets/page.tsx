'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Check, Trash2, Pencil } from 'lucide-react';
import { getIcon, AVAILABLE_ICONS } from '@/lib/utils/icons';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import type { Account, AccountType, AssetSummary } from '@/types';
import { ACCOUNT_TYPE_LABELS } from '@/types';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'debit_card', 'credit_card', 'investment', 'ebank', 'other'];

const PRESET_COLORS = [
  '#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de',
  '#5ac8fa', '#ffcc00', '#ff2d55', '#5856d6', '#636366',
  '#a2845e', '#30d158', '#00c7be', '#bf5af2', '#32ade6',
];

const TYPE_DEFAULTS: Record<AccountType, { icon: string; color: string }> = {
  cash: { icon: 'Banknote', color: '#34c759' },
  debit_card: { icon: 'Landmark', color: '#007aff' },
  credit_card: { icon: 'CreditCard', color: '#ff3b30' },
  investment: { icon: 'TrendingUp', color: '#af52de' },
  ebank: { icon: 'Wallet', color: '#ff9500' },
  other: { icon: 'CircleDollarSign', color: '#8e8e93' },
};

interface AccountForm {
  name: string;
  type: AccountType;
  institution: string;
  balance: string;
  icon: string;
  color: string;
}

const emptyForm = (): AccountForm => ({
  name: '', type: 'debit_card', institution: '', balance: '',
  icon: TYPE_DEFAULTS.debit_card.icon, color: TYPE_DEFAULTS.debit_card.color,
});

export default function AssetsPage() {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [editingBalance, setEditingBalance] = useState<number | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const fetchSummary = () => {
    fetch('/api/assets/summary').then(r => r.json()).then(setSummary);
  };

  useEffect(() => { fetchSummary(); }, []);

  const handleTypeChange = (type: AccountType) => {
    const defaults = TYPE_DEFAULTS[type];
    setForm(f => ({ ...f, type, icon: defaults.icon, color: defaults.color }));
  };

  const openAddForm = () => {
    setForm(emptyForm());
    setFormMode('add');
    setEditingId(null);
    setShowIconPicker(false);
  };

  const openEditForm = (acc: Account) => {
    setForm({
      name: acc.name,
      type: acc.type,
      institution: acc.institution || '',
      balance: String(acc.balance),
      icon: acc.icon,
      color: acc.color,
    });
    setFormMode('edit');
    setEditingId(acc.id);
    setEditingBalance(null);
    setShowIconPicker(false);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setShowIconPicker(false);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error('请输入账户名称'); return; }
    const balance = form.balance ? parseFloat(form.balance) : 0;

    if (formMode === 'add') {
      await fetch('/api/assets/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, type: form.type,
          icon: form.icon, color: form.color,
          balance, institution: form.institution || null,
        }),
      });
      toast.success('账户已添加');
    } else if (formMode === 'edit' && editingId) {
      await fetch(`/api/assets/accounts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, type: form.type,
          icon: form.icon, color: form.color,
          balance, institution: form.institution || null,
        }),
      });
      toast.success('账户已更新');
    }

    closeForm();
    fetchSummary();
  };

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

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确认删除「${name}」？历史快照也会删除。`)) return;
    await fetch(`/api/assets/accounts/${id}`, { method: 'DELETE' });
    closeForm();
    fetchSummary();
    toast.success('账户已删除');
  };

  const FormIcon = getIcon(form.icon);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1c1c1e]">我的资产</h1>
        <button
          onClick={openAddForm}
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

      {/* Add / Edit account form */}
      {formMode && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#1c1c1e]">{formMode === 'add' ? '添加账户' : '编辑账户'}</p>

          {/* Icon + Name */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ring-2 ring-[#007aff]/20 active:ring-[#007aff]/40"
              style={{ backgroundColor: `${form.color}15` }}
            >
              <FormIcon className="w-5 h-5" style={{ color: form.color }} />
            </button>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="账户名称（如：招商银行储蓄卡）"
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
              autoFocus
            />
          </div>

          {/* Icon & Color picker */}
          {showIconPicker && (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[#8e8e93] mb-1.5">颜色</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-1 ring-[#007aff] scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#8e8e93] mb-1.5">图标</p>
                <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto">
                  {AVAILABLE_ICONS.map(name => {
                    const I = getIcon(name);
                    return (
                      <button
                        key={name}
                        onClick={() => setForm({ ...form, icon: name })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          form.icon === name ? 'bg-[#007aff]/10 ring-1 ring-[#007aff]' : 'active:bg-gray-100'
                        }`}
                      >
                        <I className="w-4 h-4" style={{ color: form.icon === name ? form.color : '#8e8e93' }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Type + Balance */}
          <div className="flex gap-2">
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <input
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              placeholder="当前余额"
              type="number"
              step="0.01"
              className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
            />
          </div>

          {/* Institution */}
          <input
            value={form.institution}
            onChange={(e) => setForm({ ...form, institution: e.target.value })}
            placeholder="所属机构（可选，如：招商银行）"
            className="w-full px-3 py-2.5 bg-gray-50 rounded-xl text-sm outline-none focus:bg-gray-100"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={closeForm} className="flex-1 py-2.5 text-sm text-[#8e8e93] bg-gray-100 rounded-xl active:bg-gray-200">
              取消
            </button>
            <button onClick={handleSave} className="flex-1 py-2.5 text-sm text-white bg-[#007aff] rounded-xl active:bg-[#0066d6]">
              {formMode === 'add' ? '添加' : '保存'}
            </button>
          </div>

          {/* Delete in edit mode */}
          {formMode === 'edit' && editingId && (
            <button
              onClick={() => handleDelete(editingId, form.name)}
              className="flex items-center justify-center gap-2 w-full py-2 text-sm text-[#ff3b30] rounded-lg active:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              删除账户
            </button>
          )}
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
                const isEditingBal = editingBalance === acc.id;

                return (
                  <div key={acc.id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${acc.color}15` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: acc.color }} />
                      </div>
                      <div
                        className="flex-1 min-w-0 cursor-pointer active:opacity-70"
                        onClick={() => {
                          if (isEditingBal) return;
                          setEditingBalance(acc.id);
                          setBalanceInput(String(acc.balance));
                        }}
                      >
                        <p className="text-[15px] text-[#1c1c1e]">{acc.name}</p>
                        {acc.institution && (
                          <p className="text-xs text-[#8e8e93]">{acc.institution}</p>
                        )}
                      </div>
                      <p className={`text-[15px] font-medium tabular-nums mr-1 ${acc.balance < 0 ? 'text-[#ff3b30]' : 'text-[#1c1c1e]'}`}>
                        {formatCurrency(acc.balance)}
                      </p>
                      <button
                        onClick={() => openEditForm(acc)}
                        className="p-1.5 text-[#8e8e93] active:bg-gray-100 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Inline balance edit */}
                    {isEditingBal && (
                      <div className="px-4 pb-3">
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
      {summary && Object.values(summary.accountsByType).every(arr => !arr || arr.length === 0) && !formMode && (
        <div className="text-center py-16 text-[#8e8e93] text-sm">
          暂无账户，点击右上角添加
        </div>
      )}
    </div>
  );
}
