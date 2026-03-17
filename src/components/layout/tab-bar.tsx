'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Upload, BarChart3, Settings, Plus } from 'lucide-react';
import { useState } from 'react';
import { QuickAddPanel } from '@/components/quick-add/quick-add-panel';

const tabs = [
  { href: '/', icon: LayoutDashboard, label: '概览' },
  { href: '/import', icon: Upload, label: '导入' },
  { href: '#add', icon: Plus, label: '' },
  { href: '/reports', icon: BarChart3, label: '报告' },
  { href: '/settings', icon: Settings, label: '我的' },
];

export function TabBar() {
  const pathname = usePathname();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 md:hidden">
        <div className="flex items-center justify-around h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
          {tabs.map((tab) => {
            if (tab.href === '#add') {
              return (
                <button
                  key="add"
                  onClick={() => setShowQuickAdd(true)}
                  className="flex items-center justify-center -mt-5 w-14 h-14 rounded-full bg-[#007aff] text-white shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
                >
                  <Plus className="w-7 h-7" />
                </button>
              );
            }

            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 ${
                  isActive ? 'text-[#007aff]' : 'text-[#8e8e93]'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickAddPanel open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </>
  );
}
