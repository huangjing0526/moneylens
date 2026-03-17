'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/import/file-upload';
import { ImportPreview } from '@/components/import/import-preview';
import { toast } from 'sonner';
import type { TransactionInput, DuplicateCandidate } from '@/types';

interface ParseResult {
  source: string;
  transactions: (TransactionInput & { isDuplicate?: boolean })[];
  crossSourceDuplicates: DuplicateCandidate[];
  total: number;
  duplicateCount: number;
  errors: string[];
  debug?: { headers: string[]; rowCount: number; sampleRow?: Record<string, string> };
}

export default function ImportPage() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileParsed = (result: unknown) => {
    const r = result as ParseResult;
    if (!r.transactions || r.total === 0) {
      // No results — show debug info if available, otherwise a generic message
      if (r.debug) {
        const debugMsg = [
          `未能解析到交易记录。`,
          `识别的表头: ${r.debug.headers.join(', ') || '(无)'}`,
          `数据行数: ${r.debug.rowCount}`,
          r.debug.sampleRow
            ? `第一行数据: ${JSON.stringify(r.debug.sampleRow).slice(0, 200)}`
            : '',
          r.errors?.length ? `解析错误: ${r.errors.join('; ')}` : '',
        ].filter(Boolean).join('\n');
        setError(debugMsg);
      } else {
        setError('未能识别到交易记录，请检查文件内容或尝试其他格式。');
        toast.error('未识别到交易记录');
      }
      return;
    }
    setError(null);
    setParseResult(r);
    const sourceLabel = r.source === 'alipay' ? '支付宝' : r.source === 'wechat' ? '微信' : r.source === 'ocr' ? '截图' : '文件';
    toast.success(`${sourceLabel}识别成功，共 ${r.total} 条记录`);
  };

  const handleConfirmImport = async (transactions: TransactionInput[]) => {
    setImporting(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      const result = await res.json();
      toast.success(`成功导入 ${result.count} 条记录`);
      setParseResult(null);
    } catch (err) {
      toast.error('导入失败: ' + (err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#1c1c1e]">导入账单</h1>

      {error && (
        <div className="bg-[#ff9500]/10 text-[#1c1c1e] text-sm p-4 rounded-xl whitespace-pre-wrap">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-[#007aff] underline">关闭</button>
        </div>
      )}

      {parseResult ? (
        <ImportPreview
          source={parseResult.source}
          transactions={parseResult.transactions}
          crossSourceDuplicates={parseResult.crossSourceDuplicates || []}
          onConfirm={handleConfirmImport}
          onCancel={() => setParseResult(null)}
          importing={importing}
        />
      ) : (
        <FileUpload
          onFileParsed={handleFileParsed}
          onError={(err) => setError(err)}
          loading={loading}
          setLoading={setLoading}
        />
      )}
    </div>
  );
}
