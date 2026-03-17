'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { getIcon, AVAILABLE_ICONS } from '@/lib/utils/icons';
import { toast } from 'sonner';
import type { Category } from '@/types';

const PRESET_COLORS = [
  '#ff9500', '#007aff', '#ff2d55', '#af52de', '#5ac8fa',
  '#ff3b30', '#5856d6', '#34c759', '#ffcc00', '#ff6b6b',
  '#636366', '#a2845e', '#32ade6', '#64d2ff', '#30d158',
  '#c7c7cc', '#8e8e93', '#30db5b', '#00c7be', '#bf5af2',
];

interface EditState {
  slug: string;
  name: string;
  icon: string;
  color: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState({ slug: '', name: '', icon: 'CircleDashed', color: '#8e8e93', is_income: false });
  const [showIconPicker, setShowIconPicker] = useState<string | null>(null); // slug or 'new'

  const fetchCategories = () => {
    fetch('/api/categories').then(r => r.json()).then(setCategories);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    await fetch(`/api/categories/${editing.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, icon: editing.icon, color: editing.color }),
    });
    setEditing(null);
    fetchCategories();
    toast.success('分类已更新');
  };

  const handleDelete = async (slug: string, name: string) => {
    if (!confirm(`确定删除「${name}」分类？该分类下的交易将移至"未分类"。`)) return;
    const res = await fetch(`/api/categories/${slug}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    fetchCategories();
    toast.success('分类已删除');
  };

  const handleAdd = async () => {
    if (!newCat.slug || !newCat.name) { toast.error('请填写标识和名称'); return; }
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat),
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    setAdding(false);
    setNewCat({ slug: '', name: '', icon: 'CircleDashed', color: '#8e8e93', is_income: false });
    fetchCategories();
    toast.success('分类已添加');
  };

  const expenseCategories = categories.filter(c => !c.is_income);
  const incomeCategories = categories.filter(c => c.is_income);

  const renderCategory = (cat: Category, i: number, list: Category[]) => {
    const isEditing = editing?.slug === cat.slug;
    const Icon = getIcon(isEditing ? editing.icon : cat.icon);
    const color = isEditing ? editing.color : cat.color;

    return (
      <div key={cat.slug}>
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon (clickable when editing) */}
          <button
            onClick={() => isEditing && setShowIconPicker(showIconPicker === cat.slug ? null : cat.slug)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isEditing ? 'ring-2 ring-[#007aff]/30' : ''}`}
            style={{ backgroundColor: `${color}15` }}
            disabled={!isEditing}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </button>

          {/* Name */}
          {isEditing ? (
            <input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              className="flex-1 text-[15px] text-[#1c1c1e] bg-gray-50 px-2 py-1 rounded-lg outline-none focus:bg-gray-100"
              autoFocus
            />
          ) : (
            <span className="text-[15px] text-[#1c1c1e] flex-1">{cat.name}</span>
          )}

          {/* Actions */}
          {isEditing ? (
            <div className="flex gap-1">
              <button onClick={handleSave} className="p-1.5 text-[#34c759] hover:bg-gray-100 rounded-lg">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditing(null); setShowIconPicker(null); }} className="p-1.5 text-[#8e8e93] hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => { setEditing({ slug: cat.slug, name: cat.name, icon: cat.icon, color: cat.color }); setShowIconPicker(null); }}
                className="p-1.5 text-[#8e8e93] hover:bg-gray-100 rounded-lg"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {cat.slug !== 'uncategorized' && (
                <button
                  onClick={() => handleDelete(cat.slug, cat.name)}
                  className="p-1.5 text-[#ff3b30] hover:bg-gray-100 rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Icon & color picker */}
        {isEditing && showIconPicker === cat.slug && (
          <div className="px-4 pb-3 space-y-3">
            {/* Color picker */}
            <div>
              <p className="text-[11px] text-[#8e8e93] mb-1.5">颜色</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditing({ ...editing, color: c })}
                    className={`w-7 h-7 rounded-full transition-transform ${editing.color === c ? 'ring-2 ring-offset-1 ring-[#007aff] scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            {/* Icon picker */}
            <div>
              <p className="text-[11px] text-[#8e8e93] mb-1.5">图标</p>
              <div className="grid grid-cols-8 gap-1.5">
                {AVAILABLE_ICONS.map(name => {
                  const I = getIcon(name);
                  return (
                    <button
                      key={name}
                      onClick={() => setEditing({ ...editing, icon: name })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        editing.icon === name ? 'bg-[#007aff]/10 ring-1 ring-[#007aff]' : 'hover:bg-gray-100'
                      }`}
                    >
                      <I className="w-4 h-4" style={{ color: editing.icon === name ? editing.color : '#8e8e93' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {i < list.length - 1 && <div className="ml-16 border-b border-gray-50" />}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1c1c1e]">分类管理</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#007aff] hover:bg-[#007aff]/5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增
        </button>
      </div>

      {/* Add new category */}
      {adding && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[#1c1c1e]">新增分类</p>
          <div className="flex gap-2">
            <input
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value, slug: e.target.value ? e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_') || `cat_${Date.now()}` : '' })}
              placeholder="分类名称"
              className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:bg-gray-100"
            />
            <select
              value={newCat.is_income ? 'income' : 'expense'}
              onChange={(e) => setNewCat({ ...newCat, is_income: e.target.value === 'income' })}
              className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none"
            >
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </select>
          </div>

          {/* Color picker */}
          <div>
            <p className="text-[11px] text-[#8e8e93] mb-1.5">颜色</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewCat({ ...newCat, color: c })}
                  className={`w-7 h-7 rounded-full ${newCat.color === c ? 'ring-2 ring-offset-1 ring-[#007aff] scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <p className="text-[11px] text-[#8e8e93] mb-1.5">图标</p>
            <div className="grid grid-cols-8 gap-1.5">
              {AVAILABLE_ICONS.slice(0, 24).map(name => {
                const I = getIcon(name);
                return (
                  <button
                    key={name}
                    onClick={() => setNewCat({ ...newCat, icon: name })}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      newCat.icon === name ? 'bg-[#007aff]/10 ring-1 ring-[#007aff]' : 'hover:bg-gray-100'
                    }`}
                  >
                    <I className="w-4 h-4" style={{ color: newCat.icon === name ? newCat.color : '#8e8e93' }} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-2 text-sm text-[#8e8e93] bg-gray-100 rounded-lg">
              取消
            </button>
            <button onClick={handleAdd} className="flex-1 py-2 text-sm text-white bg-[#007aff] rounded-lg">
              添加
            </button>
          </div>
        </div>
      )}

      {/* Expense categories */}
      <div>
        <p className="text-xs text-[#8e8e93] font-medium mb-2">支出分类</p>
        <div className="bg-white rounded-xl overflow-hidden">
          {expenseCategories.map((cat, i) => (
            <div key={cat.slug} className="group">
              {renderCategory(cat, i, expenseCategories)}
            </div>
          ))}
        </div>
      </div>

      {/* Income categories */}
      <div>
        <p className="text-xs text-[#8e8e93] font-medium mb-2">收入分类</p>
        <div className="bg-white rounded-xl overflow-hidden">
          {incomeCategories.map((cat, i) => (
            <div key={cat.slug} className="group">
              {renderCategory(cat, i, incomeCategories)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
