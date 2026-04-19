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

export interface TransactionWithCategory extends Transaction {
  category_name?: string;
  account_name?: string;
}
