'use client';

import { useState } from 'react';
import { Key, Database, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#1c1c1e]">设置</h1>

      {/* API Key */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Key className="w-5 h-5 text-[#8e8e93]" />
          <div className="flex-1">
            <p className="text-[15px] text-[#1c1c1e]">Anthropic API Key</p>
            <p className="text-xs text-[#8e8e93]">用于截图 OCR 识别（可选）</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm text-[#1c1c1e] placeholder:text-[#8e8e93] outline-none"
          />
          <p className="text-[11px] text-[#8e8e93] mt-2">
            请在 .env.local 文件中设置 ANTHROPIC_API_KEY，或在此临时输入
          </p>
        </div>
      </div>

      {/* Data info */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Database className="w-5 h-5 text-[#8e8e93]" />
          <div className="flex-1">
            <p className="text-[15px] text-[#1c1c1e]">数据存储</p>
            <p className="text-xs text-[#8e8e93]">所有数据保存在本地 SQLite 数据库</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-[#8e8e93]">
            数据库路径: data/moneylens.db
          </p>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-3">
          <Info className="w-5 h-5 text-[#8e8e93]" />
          <div className="flex-1">
            <p className="text-[15px] text-[#1c1c1e]">关于</p>
            <p className="text-xs text-[#8e8e93]">钱迹透镜 MoneyLens v1.0</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-[#8e8e93]">
            本地记账分析应用 — 不记账，看账。导入已有账单，自动分类分析。
          </p>
        </div>
      </div>
    </div>
  );
}
