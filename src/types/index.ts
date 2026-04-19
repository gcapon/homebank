export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  month: string; // YYYY-MM format
  created_at: string;
  updated_at: string;
}

export interface ScheduledTransaction {
  id: string;
  account_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  memo: string;
  frequency: string;
  interval_count: number;
  day_of_week: number | null;
  day_of_month: number | null;
  week_of_month: number | null;
  weekend_action: string;
  next_date: string;
  max_posts: number | null;
  post_count: number;
  auto_post: boolean;
  active: boolean;
  last_posted: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithCategory extends Transaction {
  category_name?: string;
  account_name?: string;
}
