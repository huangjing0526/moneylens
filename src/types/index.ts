export interface Transaction {
  id: number;
  source: 'alipay' | 'wechat' | 'bank' | 'manual' | 'ocr';
  source_id: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:mm:ss
  amount: number; // positive = income, negative = expense
  type: 'income' | 'expense' | 'transfer';
  description: string;
  counterparty: string | null;
  category_slug: string;
  payment_method: string | null;
  note: string | null;
  is_duplicate: boolean;
  duplicate_of: number | null;
  import_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  source: Transaction['source'];
  source_id?: string | null;
  date: string;
  time?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  counterparty?: string | null;
  category_slug?: string;
  payment_method?: string | null;
  note?: string | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_income: boolean;
}

export interface CategoryRule {
  id: number;
  keyword: string;
  category_slug: string;
  source: 'default' | 'user' | 'learned';
  priority: number;
}

export interface ImportHistory {
  id: number;
  filename: string;
  source: string;
  total_count: number;
  imported_count: number;
  duplicate_count: number;
  created_at: string;
}

export interface DuplicateCandidate {
  transaction: TransactionInput;
  existing: Transaction;
  similarity: number;
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  totalIncome: number;
  totalExpense: number;
  byCategory: { slug: string; name: string; icon: string; color: string; amount: number }[];
  dailyExpense: { date: string; amount: number }[];
}

export interface RecurringExpense {
  description: string;
  counterparty: string | null;
  averageAmount: number;
  frequency: 'monthly';
  months: string[];
  category_slug: string;
}

// ---- Assets ----

export type AccountType = 'cash' | 'debit_card' | 'credit_card' | 'stock' | 'fund' | 'deposit' | 'investment' | 'ebank' | 'other';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: '现金',
  debit_card: '储蓄卡',
  credit_card: '信用卡',
  stock: '股票',
  fund: '基金',
  deposit: '银行定存',
  investment: '其他理财',
  ebank: '电子钱包',
  other: '其他',
};

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  balance: number;
  currency: string;
  institution: string | null;
  is_archived: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BalanceSnapshot {
  id: number;
  account_id: number;
  balance: number;
  snapshot_date: string;
  created_at: string;
}

export interface AssetSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  accountsByType: Partial<Record<AccountType, Account[]>>;
}
