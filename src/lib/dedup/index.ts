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

/**
 * Batch check same-source duplicates using a single query.
 * Returns a Set of indices that are duplicates.
 */
export async function checkSameSourceDuplicates(
  transactions: TransactionInput[]
): Promise<Set<number>> {
  const duplicateIndices = new Set<number>();
  const withSourceId = transactions
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.source_id);

  if (withSourceId.length === 0) return duplicateIndices;

  const db = await getDb();

  // Build a single query with IN clause, batched in groups of 200
  const BATCH_SIZE = 200;
  for (let start = 0; start < withSourceId.length; start += BATCH_SIZE) {
    const batch = withSourceId.slice(start, start + BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');
    const sourceIds = batch.map(({ t }) => t.source_id!);
    const source = batch[0].t.source;

    const result = await db.execute({
      sql: `SELECT source_id FROM transactions WHERE source = ? AND source_id IN (${placeholders})`,
      args: [source, ...sourceIds],
    });

    const existingIds = new Set(result.rows.map(r => r.source_id as string));
    for (const { t, i } of batch) {
      if (existingIds.has(t.source_id!)) {
        duplicateIndices.add(i);
      }
    }
  }

  return duplicateIndices;
}

// Keep single-check for backward compatibility (used elsewhere)
export async function checkSameSourceDuplicate(t: TransactionInput): Promise<boolean> {
  if (!t.source_id) return false;
  const dups = await checkSameSourceDuplicates([t]);
  return dups.has(0);
}

/**
 * Batch find cross-source duplicates using a single query per date range.
 */
export async function findCrossSourceDuplicates(
  newTransactions: TransactionInput[]
): Promise<DuplicateCandidate[]> {
  if (newTransactions.length === 0) return [];

  const db = await getDb();
  const candidates: DuplicateCandidate[] = [];

  // Find min/max date range across all transactions
  let minDate = newTransactions[0].date;
  let maxDate = newTransactions[0].date;
  for (const t of newTransactions) {
    if (t.date < minDate) minDate = t.date;
    if (t.date > maxDate) maxDate = t.date;
  }

  // Single query: fetch all existing transactions in the date range
  const result = await db.execute({
    sql: `SELECT * FROM transactions
          WHERE date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
            AND is_duplicate = 0`,
    args: [minDate, maxDate],
  });
  const existing = result.rows as unknown as Transaction[];

  // Build a lookup by amount (rounded) for fast matching
  const byAmount = new Map<string, Transaction[]>();
  for (const e of existing) {
    const key = Math.abs(e.amount).toFixed(2);
    const list = byAmount.get(key) || [];
    list.push(e);
    byAmount.set(key, list);
  }

  // Match each new transaction against existing ones
  for (const t of newTransactions) {
    const key = Math.abs(t.amount).toFixed(2);
    const matches = byAmount.get(key);
    if (!matches) continue;

    for (const e of matches) {
      // Check date proximity (within 1 day)
      const tDate = new Date(t.date).getTime();
      const eDate = new Date(e.date).getTime();
      if (Math.abs(tDate - eDate) > 86400000) continue;

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
