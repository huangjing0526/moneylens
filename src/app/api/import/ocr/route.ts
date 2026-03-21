import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import type { TransactionInput } from '@/types';
import { classifyTransactions } from '@/lib/categories/engine';

const OCR_TIMEOUT_MS = 60_000; // 60 seconds

// Parse OCR raw text into structured transactions
function parseOcrText(text: string): TransactionInput[] {
  const transactions: TransactionInput[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const dateAmountPattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2})/;
  const amountPattern = /[¥￥]?\s*-?(\d+[.,]\d{1,2})/;

  const currentYear = new Date().getFullYear();

  for (const line of lines) {
    const amountMatch = line.match(amountPattern);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1].replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;

    const dateMatch = line.match(dateAmountPattern);
    let date = '';
    if (dateMatch) {
      const raw = dateMatch[1].replace(/\//g, '-');
      if (raw.length <= 5) {
        date = `${currentYear}-${raw.padStart(5, '0')}`;
      } else {
        date = raw;
      }
      const parts = date.split('-');
      if (parts.length === 3) {
        date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    } else {
      const now = new Date();
      date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    let description = line
      .replace(dateAmountPattern, '')
      .replace(/[¥￥]?\s*-?\d+[.,]\d{1,2}/, '')
      .replace(/[:\s]+/g, ' ')
      .trim();

    if (!description) description = '截图识别';

    const isExpense = line.includes('-') || !line.includes('+');

    transactions.push({
      source: 'ocr',
      date,
      amount: isExpense ? -amount : amount,
      type: isExpense ? 'expense' : 'income',
      description,
    });
  }

  return transactions;
}

async function ocrWithTesseract(buffer: Buffer): Promise<TransactionInput[]> {
  const worker = await createWorker('chi_sim+eng');
  try {
    const { data } = await worker.recognize(buffer);
    return parseOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}超时（${Math.round(ms / 1000)}秒），请稍后重试`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function ocrWithClaude(buffer: Buffer, mimeType: string, apiKey: string): Promise<TransactionInput[]> {
  const base64 = buffer.toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `请识别这张账单截图中的所有交易记录，以 JSON 数组格式返回。每条记录包含：
- date: 日期，格式 YYYY-MM-DD
- amount: 金额数字（正数）
- type: "income"、"expense" 或 "transfer"（转账给他人或收到转账）
- description: 交易描述/商品名
- counterparty: 交易对方（如有）

只返回 JSON 数组，不要其他文字。如果无法识别，返回空数组 []。`,
          },
        ],
      }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    date: string;
    amount: number;
    type: 'income' | 'expense' | 'transfer';
    description: string;
    counterparty?: string;
  }>;

  return parsed.map(item => ({
    source: 'ocr' as const,
    date: item.date,
    amount: item.type === 'expense' ? -item.amount : (item.type === 'transfer' ? -item.amount : item.amount),
    type: item.type,
    description: item.description,
    counterparty: item.counterparty || null,
  }));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: '请上传图片' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/png';
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let transactions: TransactionInput[];
    let engine: string;

    if (apiKey) {
      transactions = await withTimeout(
        ocrWithClaude(buffer, mimeType, apiKey),
        OCR_TIMEOUT_MS,
        'Claude OCR 识别'
      );
      engine = 'claude';
    } else {
      transactions = await withTimeout(
        ocrWithTesseract(buffer),
        OCR_TIMEOUT_MS,
        'Tesseract OCR 识别'
      );
      engine = 'tesseract';
    }

    const classified = await classifyTransactions(transactions);

    return NextResponse.json({
      source: 'ocr',
      transactions: classified,
      crossSourceDuplicates: [],
      total: classified.length,
      duplicateCount: 0,
      engine,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'OCR 处理失败: ' + (error as Error).message,
    }, { status: 500 });
  }
}
