import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test stringSimilarity by extracting the logic since it's not exported.
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 100;

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const ba = getBigrams(la);
  const bb = getBigrams(lb);
  let intersection = 0;
  for (const b of ba) {
    if (bb.has(b)) intersection++;
  }
  const union = ba.size + bb.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

describe('stringSimilarity', () => {
  it('returns 100 for identical strings', () => {
    expect(stringSimilarity('hello', 'hello')).toBe(100);
  });

  it('is case-insensitive', () => {
    expect(stringSimilarity('Hello', 'hello')).toBe(100);
  });

  it('returns 0 for empty strings', () => {
    expect(stringSimilarity('', 'hello')).toBe(0);
    expect(stringSimilarity('hello', '')).toBe(0);
    expect(stringSimilarity('', '')).toBe(0);
  });

  it('returns high similarity for similar strings', () => {
    const sim = stringSimilarity('美团外卖订单', '美团外卖');
    expect(sim).toBeGreaterThanOrEqual(60);
  });

  it('returns low similarity for different strings', () => {
    const sim = stringSimilarity('美团外卖', '交通出行');
    expect(sim).toBeLessThan(30);
  });

  it('handles single character strings', () => {
    expect(stringSimilarity('a', 'b')).toBe(0);
  });

  it('handles two character strings', () => {
    expect(stringSimilarity('ab', 'ab')).toBe(100);
    expect(stringSimilarity('ab', 'cd')).toBe(0);
  });

  it('returns partial similarity for overlapping strings', () => {
    const sim = stringSimilarity('abcdef', 'abcxyz');
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(100);
  });

  it('handles Chinese characters correctly', () => {
    const sim = stringSimilarity('海底捞火锅', '海底捞');
    expect(sim).toBeGreaterThan(40);
  });

  it('returns symmetric results', () => {
    const ab = stringSimilarity('美团', '美团外卖');
    const ba = stringSimilarity('美团外卖', '美团');
    expect(ab).toBe(ba);
  });
});

// Mock db module for integration tests
const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
  }),
}));

describe('checkSameSourceDuplicate', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('returns false when source_id is not provided', async () => {
    const { checkSameSourceDuplicate } = await import('../index');
    const result = await checkSameSourceDuplicate({
      source: 'alipay',
      date: '2024-01-01',
      amount: -100,
      type: 'expense',
      description: 'test',
    });
    expect(result).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns true when duplicate exists in DB', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: 1 }] });
    const { checkSameSourceDuplicate } = await import('../index');
    const result = await checkSameSourceDuplicate({
      source: 'alipay',
      source_id: 'ALI001',
      date: '2024-01-01',
      amount: -100,
      type: 'expense',
      description: 'test',
    });
    expect(result).toBe(true);
  });

  it('returns false when no duplicate in DB', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const { checkSameSourceDuplicate } = await import('../index');
    const result = await checkSameSourceDuplicate({
      source: 'alipay',
      source_id: 'ALI002',
      date: '2024-01-01',
      amount: -100,
      type: 'expense',
      description: 'test',
    });
    expect(result).toBe(false);
  });
});

describe('findCrossSourceDuplicates', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('finds duplicates with matching amount and similar description', async () => {
    const mockExistingTransaction = {
      id: 1,
      source: 'alipay',
      source_id: 'alipay-001',
      date: '2024-01-15',
      time: '12:00:00',
      amount: -50.00,
      type: 'expense',
      description: '美团外卖订单',
      counterparty: '美团',
      category_slug: 'food',
      payment_method: '支付宝',
      note: null,
      is_duplicate: false,
      duplicate_of: null,
      import_id: null,
      created_at: '2024-01-15',
      updated_at: '2024-01-15',
    };

    mockExecute.mockResolvedValue({ rows: [mockExistingTransaction] });

    const { findCrossSourceDuplicates } = await import('../index');
    const candidates = await findCrossSourceDuplicates([{
      source: 'wechat' as const,
      date: '2024-01-15',
      amount: -50.00,
      type: 'expense' as const,
      description: '美团外卖',
      counterparty: '美团',
    }]);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].similarity).toBeGreaterThanOrEqual(70);
  });

  it('does not flag low-similarity transactions as duplicates', async () => {
    const mockExistingTransaction = {
      id: 2,
      source: 'alipay',
      date: '2024-01-15',
      amount: -50.00,
      type: 'expense',
      description: '完全不同的描述',
      counterparty: '完全不同',
      is_duplicate: false,
    };

    mockExecute.mockResolvedValue({ rows: [mockExistingTransaction] });

    const { findCrossSourceDuplicates } = await import('../index');
    const candidates = await findCrossSourceDuplicates([{
      source: 'wechat' as const,
      date: '2024-01-15',
      amount: -50.00,
      type: 'expense' as const,
      description: 'XYZ全新内容ABC',
      counterparty: 'QWERTY',
    }]);

    expect(candidates).toHaveLength(0);
  });

  it('returns empty array when no amount matches', async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    const { findCrossSourceDuplicates } = await import('../index');
    const candidates = await findCrossSourceDuplicates([{
      source: 'wechat' as const,
      date: '2024-01-15',
      amount: -999.99,
      type: 'expense' as const,
      description: '独特消费',
    }]);

    expect(candidates).toHaveLength(0);
  });
});
