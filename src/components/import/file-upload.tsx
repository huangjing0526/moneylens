'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Image, Loader2, CheckCircle2, FileText, X } from 'lucide-react';

interface FileUploadProps {
  onFileParsed: (result: unknown) => void;
  onError: (error: string) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

type UploadStage = 'idle' | 'uploading' | 'parsing' | 'classifying' | 'done';

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: '',
  uploading: '上传文件中...',
  parsing: '解析账单数据...',
  classifying: '智能分类中...',
  done: '解析完成',
};

export function FileUpload({ onFileParsed, onError, loading, setLoading }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<UploadStage>('idle');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed time counter
  useEffect(() => {
    if (stage !== 'idle' && stage !== 'done') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [stage]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage('idle');
    setLoading(false);
  }, [setLoading]);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    setStage('uploading');

    const isImage = file.type.startsWith('image/');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    setFileType(isImage ? 'screenshot' : isExcel ? 'excel' : 'csv');

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const endpoint = isImage
        ? '/api/import/ocr'
        : isExcel
          ? '/api/import/excel'
          : '/api/import/csv';

      // Simulate stage progression for better UX
      await new Promise(r => setTimeout(r, 300));
      setStage('parsing');

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      setStage('classifying');
      await new Promise(r => setTimeout(r, 200));

      const result = await response.json();

      if (result.error) {
        setStage('idle');
        onError(result.error);
      } else {
        setStage('done');
        await new Promise(r => setTimeout(r, 400));
        onFileParsed(result);
        setStage('idle');
      }
    } catch (err) {
      setStage('idle');
      if ((err as Error).name === 'AbortError') {
        onError('已取消识别');
      } else {
        onError('文件解析失败：' + (err as Error).message);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [onFileParsed, onError, setLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const isProcessing = stage !== 'idle';

  return (
    <div>
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative rounded-2xl text-center transition-all overflow-hidden ${
          isProcessing
            ? 'bg-white pointer-events-none'
            : dragOver
              ? 'border-2 border-dashed border-[#007aff] bg-[#007aff]/5 cursor-pointer p-8'
              : 'border-2 border-dashed border-gray-200 hover:border-gray-300 bg-white cursor-pointer p-8'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
          className="hidden"
        />

        {isProcessing ? (
          /* Processing state with progress */
          <div className="py-6 px-4">
            {/* File info */}
            <div className="flex items-center gap-3 mb-5 justify-center">
              <div className="w-10 h-10 rounded-xl bg-[#007aff]/10 flex items-center justify-center">
                {fileType === 'screenshot'
                  ? <Image className="w-5 h-5 text-[#ff9500]" />
                  : <FileText className="w-5 h-5 text-[#007aff]" />
                }
              </div>
              <div className="text-left">
                <p className="text-[14px] text-[#1c1c1e] font-medium truncate max-w-[200px]">{fileName}</p>
                <p className="text-[12px] text-[#8e8e93]">
                  {fileType === 'screenshot' ? '截图识别' : fileType === 'excel' ? 'Excel 文件' : 'CSV 文件'}
                </p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="space-y-3">
              {(['uploading', 'parsing', 'classifying'] as UploadStage[]).map((s) => {
                const isActive = s === stage;
                const isDone = ['uploading', 'parsing', 'classifying'].indexOf(s)
                  < ['uploading', 'parsing', 'classifying'].indexOf(stage)
                  || stage === 'done';

                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-[#34c759]" />
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 text-[#007aff] animate-spin" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-gray-200" />
                      )}
                    </div>
                    <span className={`text-[14px] ${
                      isActive ? 'text-[#007aff] font-medium' : isDone ? 'text-[#34c759]' : 'text-[#c7c7cc]'
                    }`}>
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#007aff] rounded-full transition-all duration-500 ease-out"
                style={{
                  width: stage === 'uploading' ? '30%'
                    : stage === 'parsing' ? '60%'
                    : stage === 'classifying' ? '85%'
                    : stage === 'done' ? '100%' : '0%',
                }}
              />
            </div>

            {/* Elapsed time + hint */}
            <div className="flex items-center justify-between mt-3">
              <p className="text-[12px] text-[#8e8e93]">
                {fileType === 'screenshot' && stage === 'parsing'
                  ? '截图识别中，请耐心等待...'
                  : elapsed > 0 ? `已用时 ${elapsed}秒` : ''
                }
              </p>
              {/* Cancel button */}
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 text-[12px] text-[#ff3b30] hover:bg-[#ff3b30]/5 px-2 py-1 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                取消
              </button>
            </div>
            {fileType === 'screenshot' && elapsed >= 5 && (
              <p className="text-[11px] text-[#ff9500] mt-1">
                提示：配置 ANTHROPIC_API_KEY 可大幅提升识别速度和准确率
              </p>
            )}
          </div>
        ) : (
          /* Idle state */
          <>
            <Upload className="w-10 h-10 mx-auto mb-3 text-[#8e8e93]" strokeWidth={1.5} />
            <p className="text-[15px] text-[#1c1c1e] font-medium mb-1">
              点击或拖拽上传
            </p>
            <p className="text-[13px] text-[#8e8e93]">
              支持 CSV / Excel / 截图
            </p>
          </>
        )}
      </div>

      {/* Quick entries */}
      {!isProcessing && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { icon: FileSpreadsheet, label: '支付宝账单', color: '#007aff', accept: '.csv,.xlsx,.xls' },
            { icon: FileSpreadsheet, label: '微信账单', color: '#07c160', accept: '.csv,.xlsx,.xls' },
            { icon: Image, label: '截图识别', color: '#ff9500', accept: 'image/*' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = item.accept;
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFile(file);
                  };
                  input.click();
                }}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <Icon className="w-6 h-6" style={{ color: item.color }} />
                <span className="text-xs text-[#1c1c1e]">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
