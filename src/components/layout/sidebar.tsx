'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Upload, List, BarChart3, Tag, Settings, Plus } from 'lucide-react';
import { useState } from 'react';
import { QuickAddPanel } from '@/components/quick-add/quick-add-panel';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: '概览' },
  { href: '/import', icon: Upload, label: '导入' },
  { href: '/transactions', icon: List, label: '账单' },
  { href: '/reports', icon: BarChart3, label: '报告' },
  { href: '/categories', icon: Tag, label: '分类' },
  { href: '/settings', icon: Settings, label: '设置' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col bg-white/80 backdrop-blur-xl border-r border-gray-100 transition-all duration-200 ${
          expanded ? 'w-48' : 'w-16'
        }`}
      >
        <div className="flex items-center h-14 px-4 gap-2">
          <img src="/icon.svg" alt="钱迹" className="w-8 h-8 rounded-lg shrink-0" />
          {expanded && (
            <span className="text-lg font-semibold text-[#007aff] whitespace-nowrap">钱迹</span>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2 py-2">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[#007aff]/10 text-[#007aff]'
                    : 'text-[#8e8e93] hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                {expanded && (
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-4">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-[#007aff] text-white hover:bg-[#0066d6] transition-colors"
          >
            <Plus className="w-5 h-5 shrink-0" />
            {expanded && <span className="text-sm font-medium">记一笔</span>}
          </button>
        </div>
      </aside>

      <QuickAddPanel open={showQuickAdd} onClose={() => setShowQuickAdd(false)} onSaved={() => window.location.reload()} />
    </>
  );
}
