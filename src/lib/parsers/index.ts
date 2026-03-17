import Papa from 'papaparse';
import * as iconv from 'iconv-lite';
import { isAlipayCSV, parseAlipayCSV } from './alipay';
import { isWechatCSV, parseWechatCSV } from './wechat';
import type { TransactionInput } from '@/types';

export type ParseResult = {
  source: 'alipay' | 'wechat' | 'bank';
  transactions: TransactionInput[];
  errors: string[];
  debug?: { headers: string[]; rowCount: number; sampleRow?: Record<string, string> };
};

function decodeBuffer(buffer: Buffer): string {
  // Try UTF-8 first, if it contains replacement chars try GBK
  const utf8 = buffer.toString('utf-8');
  if (!utf8.includes('\ufffd')) return utf8;
  return iconv.decode(buffer, 'gbk');
}

function skipMetaLines(text: string): string {
  // Alipay/WeChat CSVs often have header meta lines before actual CSV data
  const lines = text.split('\n');
  let startIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Look for a line that has multiple commas (likely the header row)
    // Use >= 3 instead of 5 to be more lenient
    const commaCount = line.split(',').length;
    if (commaCount >= 3 && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('---')) {
      startIdx = i;
      break;
    }
  }
  return lines.slice(startIdx).join('\n');
}

export function parseCSV(buffer: Buffer, filename: string): ParseResult {
  const text = decodeBuffer(buffer);
  const csvText = skipMetaLines(text);

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().replace(/\t/g, ''),
  });

  const headers = parsed.meta.fields || [];
  const rows = parsed.data as Record<string, string>[];
  const errors: string[] = parsed.errors.map(e => e.message);
  const debug = {
    headers,
    rowCount: rows.length,
    sampleRow: rows[0] || undefined,
  };

  if (isAlipayCSV(headers)) {
    return { source: 'alipay', transactions: parseAlipayCSV(rows), errors, debug };
  }
  if (isWechatCSV(headers)) {
    return { source: 'wechat', transactions: parseWechatCSV(rows), errors, debug };
  }

  // Generic CSV: try common column patterns
  return { source: 'bank', transactions: parseGenericCSV(rows, headers), errors, debug };
}

function findColumn(headers: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const found = headers.find(h => pattern.test(h));
    if (found) return found;
  }
  return undefined;
}

function parseGenericCSV(rows: Record<string, string>[], headers: string[]): TransactionInput[] {
  const transactions: TransactionInput[] = [];

  // Broader matching patterns for column detection
  const dateCol = findColumn(headers, [
    /^日期$/, /^交易日期$/, /^交易时间$/, /^时间$/, /^记账日期$/,
    /date/i, /time/i,
    /日期/, /时间/,
  ]);
  const amountCol = findColumn(headers, [
    /^金额/, /^交易金额/, /^收支金额/, /^发生额/,
    /amount/i, /money/i,
    /金额/, /发生额/,
  ]);
  const descCol = findColumn(headers, [
    /^描述$/, /^摘要$/, /^说明$/, /^备注$/, /^交易说明$/, /^商品$/,
    /^交易类型$/, /^用途$/, /^对方信息$/,
    /description/i, /memo/i, /remark/i,
    /描述/, /摘要/, /说明/, /备注/, /商品/, /用途/,
  ]);
  const typeCol = findColumn(headers, [
    /^收\/支$/, /^收支$/, /^类型$/, /^交易类型$/,
    /^收支类型$/, /^方向$/,
    /type/i,
  ]);
  const counterpartyCol = findColumn(headers, [
    /^交易对方$/, /^对方$/, /^对方户名$/, /^收款方$/, /^付款方$/,
    /counterparty/i, /payee/i,
    /对方/, /收款/, /付款/,
  ]);

  // If we can't find date AND amount columns, try to be even more lenient:
  // look for any column that might contain date-like or amount-like values
  if (!dateCol || !amountCol) {
    // Try to guess from first data row
    if (rows.length > 0) {
      const firstRow = rows[0];
      let guessedDateCol: string | undefined;
      let guessedAmountCol: string | undefined;

      for (const [key, value] of Object.entries(firstRow)) {
        const val = (value || '').trim();
        if (!guessedDateCol && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(val)) {
          guessedDateCol = key;
        }
        if (!guessedAmountCol && /^-?[\d,]+\.?\d*$/.test(val.replace(/[¥￥]/g, ''))) {
          guessedAmountCol = key;
        }
      }

      if (guessedDateCol && guessedAmountCol) {
        return parseRowsWithColumns(rows, guessedDateCol, guessedAmountCol, descCol, typeCol, counterpartyCol);
      }
    }
    return transactions;
  }

  return parseRowsWithColumns(rows, dateCol, amountCol, descCol, typeCol, counterpartyCol);
}

function parseRowsWithColumns(
  rows: Record<string, string>[],
  dateCol: string,
  amountCol: string,
  descCol?: string,
  typeCol?: string,
  counterpartyCol?: string,
): TransactionInput[] {
  const transactions: TransactionInput[] = [];

  for (const row of rows) {
    const rawAmount = (row[amountCol] || '').trim().replace(/[¥￥,\s]/g, '');
    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount === 0) continue;

    const rawDate = (row[dateCol] || '').trim();
    // Handle various date formats: YYYY/MM/DD, YYYY-MM-DD, YYYY年MM月DD日, etc.
    let date = rawDate
      .replace(/\//g, '-')
      .replace(/年|月/g, '-')
      .replace(/日/g, '')
      .split(' ')[0];

    // Validate date looks like YYYY-MM-DD
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
      // Try to extract date pattern
      const match = rawDate.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
      if (match) {
        date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        continue;
      }
    } else {
      // Pad month and day
      const parts = date.split('-');
      date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }

    const typeStr = typeCol ? (row[typeCol] || '').trim() : '';
    const isIncome = typeStr === '收入' || typeStr === '已收入' ||
                     typeStr === 'income' ||
                     (!typeCol && amount > 0);

    const description = descCol ? (row[descCol] || '').trim() : '';
    const counterparty = counterpartyCol ? (row[counterpartyCol] || '').trim() : undefined;

    // Try to get time if date column contains it
    const timePart = rawDate.split(' ')[1] || null;

    transactions.push({
      source: 'bank',
      date,
      time: timePart,
      amount: isIncome ? Math.abs(amount) : -Math.abs(amount),
      type: isIncome ? 'income' : 'expense',
      description: description || counterparty || '交易',
      counterparty: counterparty || undefined,
    });
  }
  return transactions;
}

// Known data header keywords — if a row contains enough of these, it's the real header row
const DATA_HEADER_KEYWORDS = [
  '交易时间', '交易日期', '日期', '时间',
  '金额', '交易金额', '金额(元)', '金额（元）',
  '收/支', '收支',
  '交易对方', '对方', '商品', '商品说明',
  '交易状态', '交易类型', '交易分类',
  '交易号', '交易订单号', '商家订单号',
  '收/付款方式', '支付方式',
  '备注', '描述', '摘要',
];

function findHeaderRowIndex(sheet: unknown, XLSX: { utils: { sheet_to_json: (s: unknown, opts?: Record<string, unknown>) => unknown[][] } }): number {
  // Read sheet as raw 2D array (no header inference)
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  for (let i = 0; i < Math.min(raw.length, 30); i++) {
    const row = raw[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map(c => String(c ?? '').trim());
    const matchCount = cells.filter(c => DATA_HEADER_KEYWORDS.includes(c)).length;
    if (matchCount >= 3) return i;
  }
  return 0; // fallback to first row
}

function excelRowsToStringRows(
  jsonData: Record<string, unknown>[],
  XLSX: { SSF: { parse_date_code: (v: number) => { y: number; m: number; d: number } } },
): Record<string, string>[] {
  return jsonData.map(row => {
    const strRow: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        strRow[key] = value.toISOString().split('T')[0];
      } else if (typeof value === 'number') {
        if (key.includes('日期') || key.includes('时间') || key.toLowerCase().includes('date')) {
          if (value > 30000 && value < 60000) {
            const excelDate = XLSX.SSF.parse_date_code(value);
            strRow[key] = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
          } else {
            strRow[key] = String(value);
          }
        } else {
          strRow[key] = String(value);
        }
      } else {
        strRow[key] = String(value ?? '');
      }
    }
    return strRow;
  });
}

export function parseExcel(buffer: Buffer, filename: string): ParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Find the real header row (skip meta lines like "微信支付账单明细", nickname, etc.)
  const headerRowIdx = findHeaderRowIndex(sheet, XLSX);

  // Read raw 2D array to extract header and data
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

  if (raw.length <= headerRowIdx + 1) {
    return { source: 'bank', transactions: [], errors: ['Excel 文件为空或无数据行'], debug: { headers: [], rowCount: 0 } };
  }

  // Build header from the detected row
  const headerRow = raw[headerRowIdx].map(c => String(c ?? '').trim());
  const dataRows = raw.slice(headerRowIdx + 1);

  // Convert to Record<string, string>[] using the detected headers
  const jsonData: Record<string, unknown>[] = dataRows
    .filter(row => Array.isArray(row) && row.some(c => c !== '' && c != null))
    .map(row => {
      const obj: Record<string, unknown> = {};
      headerRow.forEach((h, i) => {
        if (h) obj[h] = (row as unknown[])[i] ?? '';
      });
      return obj;
    });

  if (jsonData.length === 0) {
    return { source: 'bank', transactions: [], errors: ['Excel 文件为空'], debug: { headers: headerRow, rowCount: 0 } };
  }

  const headers = headerRow.filter(h => h !== '');
  const rows = excelRowsToStringRows(jsonData, XLSX);

  const debug = {
    headers,
    rowCount: rows.length,
    sampleRow: rows[0] || undefined,
  };

  // Check if it's Alipay or WeChat format
  if (isAlipayCSV(headers)) {
    return { source: 'alipay', transactions: parseAlipayCSV(rows), errors: [], debug };
  }
  if (isWechatCSV(headers)) {
    return { source: 'wechat', transactions: parseWechatCSV(rows), errors: [], debug };
  }

  // Generic
  return { source: 'bank', transactions: parseGenericCSV(rows, headers), errors: [], debug };
}
