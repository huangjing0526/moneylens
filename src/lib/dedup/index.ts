import { getDb } from '@/lib/db';
import type { Transaction, TransactionInput, DuplicateCandidate } from '@/types';

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

export async function checkSameSourceDuplicate(t: TransactionInput): Promise<boolean> {
  if (!t.source_id) return false;
  const db = await getDb();
  const result = await db.execute({
    sql: 'SELECT id FROM transactions WHERE source = ? AND source_id = ?',
    args: [t.source, t.source_id || null],
  });
  return result.rows.length > 0;
}

export async function findCrossSourceDuplicates(
  newTransactions: TransactionInput[]
): Promise<DuplicateCandidate[]> {
  const db = await getDb();
  const candidates: DuplicateCandidate[] = [];

  for (const t of newTransactions) {
    const absAmount = Math.abs(t.amount);
    const result = await db.execute({
      sql: `SELECT * FROM transactions
            WHERE ABS(ABS(amount) - ?) < 0.01
              AND date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
              AND is_duplicate = 0`,
      args: [absAmount, t.date, t.date],
    });
    const existing = result.rows as unknown as Transaction[];

    for (const e of existing) {
      const descSim = stringSimilarity(t.description, e.description);
      const cpSim = stringSimilarity(t.counterparty || '', e.counterparty || '');
      const score = Math.max(descSim, cpSim);

      if (score >= 70) {
        candidates.push({ transaction: t, existing: e, similarity: score });
      }
    }
  }

  return candidates;
}
