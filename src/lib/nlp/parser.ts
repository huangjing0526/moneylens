import { format, subDays, startOfWeek, addDays, getDay } from 'date-fns';

export interface NLPParseResult {
  amount: number;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense' | 'transfer';
  description: string;
  confidence: number; // 0-1
}

const INCOME_KEYWORDS = [
  '工资', '薪资', '奖金', '收入', '红包', '退款', '报销', '利息', '分红', '收到', '到账',
];

const TRANSFER_KEYWORDS = [
  '转账', '转给', '转出', '转入', '转钱', '还钱', '借钱',
];

// Amount patterns: ¥35, ￥35, 35元, 35块, 35.5, plain numbers
const AMOUNT_REGEX = /[¥￥]?\s*(\d+(?:\.\d+)?)\s*[元块]?/g;

// Date patterns — order matters: longer patterns first
const DATE_PATTERNS: { regex: RegExp; resolve: (match: RegExpMatchArray, now: Date) => Date }[] = [
  // Explicit dates with 月: 3月15日, 3月15
  {
    regex: /(\d{1,2})月(\d{1,2})[日号]?/,
    resolve: (m, now) => {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      return new Date(now.getFullYear(), month - 1, day);
    },
  },
  // Explicit dates: 03-15, 3/15
  {
    regex: /(\d{1,2})[\-/](\d{1,2})(?!\.\d)/,
    resolve: (m, now) => {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      return new Date(now.getFullYear(), month - 1, day);
    },
  },
  // Explicit dates with dot: 3.15 — only match if month is 1-12
  {
    regex: /(?<!\d)(1[0-2]|0?[1-9])\.([0-2]?\d|3[01])(?!\d)/,
    resolve: (m, now) => {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      return new Date(now.getFullYear(), month - 1, day);
    },
  },
  // 大前天
  {
    regex: /大前天/,
    resolve: (_m, now) => subDays(now, 3),
  },
  // 前天
  {
    regex: /前天/,
    resolve: (_m, now) => subDays(now, 2),
  },
  // 昨天
  {
    regex: /昨天/,
    resolve: (_m, now) => subDays(now, 1),
  },
  // 今天
  {
    regex: /今天/,
    resolve: (_m, now) => now,
  },
  // 上周一~上周日
  {
    regex: /上(周|星期)([一二三四五六日天])/,
    resolve: (m, now) => {
      const dayIndex = parseDayOfWeek(m[2]);
      // Start of this week (Monday) then go back 7 days to get last week's Monday
      const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
      const lastMonday = subDays(thisMonday, 7);
      return addDays(lastMonday, dayIndex);
    },
  },
  // 本周一~本周日
  {
    regex: /本(周|星期)([一二三四五六日天])/,
    resolve: (m, now) => {
      const dayIndex = parseDayOfWeek(m[2]);
      const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
      return addDays(thisMonday, dayIndex);
    },
  },
  // 周一~周日 / 星期一~星期天 — most recent past occurrence (or today)
  {
    regex: /(周|星期)([一二三四五六日天])/,
    resolve: (m, now) => {
      const targetDay = parseDayOfWeek(m[2]);
      // getDay: 0=Sun, 1=Mon ... 6=Sat. Convert to Mon=0 based.
      const currentDay = (getDay(now) + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
      let diff = currentDay - targetDay;
      if (diff < 0) diff += 7;
      return subDays(now, diff);
    },
  },
];

function parseDayOfWeek(ch: string): number {
  const map: Record<string, number> = {
    '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6, '天': 6,
  };
  return map[ch] ?? 0;
}

function extractDate(input: string, now: Date): { date: Date; remaining: string } {
  for (const { regex, resolve } of DATE_PATTERNS) {
    const match = input.match(regex);
    if (match) {
      const date = resolve(match, now);
      const remaining = input.replace(match[0], '').trim();
      return { date, remaining };
    }
  }
  return { date: now, remaining: input };
}

function extractAmount(input: string): { amount: number; remaining: string } | null {
  // Find all number occurrences, pick the last one as the amount
  const matches: { value: number; fullMatch: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  const regex = /[¥￥]?\s*(\d+(?:\.\d+)?)\s*[元块]?/g;

  while ((m = regex.exec(input)) !== null) {
    const value = parseFloat(m[1]);
    if (!isNaN(value) && value > 0) {
      matches.push({ value, fullMatch: m[0], index: m.index });
    }
  }

  if (matches.length === 0) return null;

  // Pick the last number as the amount
  const chosen = matches[matches.length - 1];
  const remaining = (
    input.slice(0, chosen.index) + input.slice(chosen.index + chosen.fullMatch.length)
  ).trim();

  return { amount: chosen.value, remaining };
}

function detectType(description: string): 'income' | 'expense' | 'transfer' {
  for (const kw of TRANSFER_KEYWORDS) {
    if (description.includes(kw)) return 'transfer';
  }
  for (const kw of INCOME_KEYWORDS) {
    if (description.includes(kw)) return 'income';
  }
  return 'expense';
}

export function parseNaturalLanguage(input: string, now?: Date): NLPParseResult | null {
  if (!input || !input.trim()) return null;

  const currentDate = now ?? new Date();
  let text = input.trim();

  // 1. Extract date
  const { date, remaining: afterDate } = extractDate(text, currentDate);

  // 2. Extract amount
  const amountResult = extractAmount(afterDate);
  if (!amountResult) return null;

  const { amount, remaining: description } = amountResult;

  // 3. Clean up description
  const cleanDesc = description.replace(/\s+/g, ' ').trim();

  // 4. Detect type
  const type = detectType(cleanDesc || input);

  // 5. Confidence
  let confidence: number;
  if (cleanDesc.length > 0 && amount > 0) {
    confidence = 1.0;
  } else if (amount > 0) {
    confidence = 0.8;
  } else {
    confidence = 0.5;
  }

  return {
    amount,
    date: format(date, 'yyyy-MM-dd'),
    type,
    description: cleanDesc,
    confidence,
  };
}
