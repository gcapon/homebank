-- HomeBank Web - Supabase Schema

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checking',
  balance NUMERIC(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table (with hierarchical support)
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM format
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, month)
);

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (for now - add auth later)
CREATE POLICY "Public read/write accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public read/write budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

-- Scheduled Transactions table
CREATE TABLE IF NOT EXISTS scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(15,2) NOT NULL,
  memo TEXT DEFAULT '',
  frequency TEXT NOT NULL DEFAULT 'monthly', -- daily, weekly, monthly, yearly
  interval_count INTEGER NOT NULL DEFAULT 1,  -- every X frequency units
  day_of_week INTEGER,                        -- 0=Sun, 1=Mon, ... 6=Sat (for weekly)
  day_of_month INTEGER,                        -- 1-31 (for monthly)
  week_of_month INTEGER,                       -- 1-5 (for "1st Monday", "2nd Friday" style)
  weekend_action TEXT DEFAULT 'possible',      -- possible, before, after
  next_date DATE NOT NULL,
  max_posts INTEGER,                           -- NULL = unlimited
  post_count INTEGER NOT NULL DEFAULT 0,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  last_posted DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE scheduled_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for owner" ON scheduled_transactions FOR ALL USING (true) WITH CHECK (true);

-- Index for finding due transactions
CREATE INDEX IF NOT EXISTS idx_scheduled_next_date ON scheduled_transactions(next_date) WHERE active = true;

-- Function to process due scheduled transactions (for cron)
CREATE OR REPLACE FUNCTION process_due_scheduled_transactions()
RETURNS void AS $$
DECLARE
  due_item RECORD;
BEGIN
  FOR due_item IN
    SELECT st.*, a.balance as account_balance
    FROM scheduled_transactions st
    JOIN accounts a ON st.account_id = a.id
    WHERE st.active = true
      AND st.next_date <= CURRENT_DATE
      AND st.auto_post = true
  LOOP
    -- Create the transaction
    INSERT INTO transactions (account_id, category_id, description, amount, date, memo, created_at, updated_at)
    VALUES (
      due_item.account_id,
      due_item.category_id,
      due_item.description,
      due_item.amount,
      CURRENT_DATE,
      due_item.memo,
      NOW(),
      NOW()
    );
    
    -- Update account balance
    UPDATE accounts
    SET balance = balance + due_item.amount, updated_at = NOW()
    WHERE id = due_item.account_id;
    
    -- Advance to next date
    UPDATE scheduled_transactions
    SET 
      next_date = CASE
        WHEN frequency = 'daily' THEN next_date + (interval_count || ' days')::interval
        WHEN frequency = 'weekly' THEN next_date + (interval_count * 7 || ' days')::interval
        WHEN frequency = 'monthly' THEN next_date + (interval_count || ' months')::interval
        WHEN frequency = 'yearly' THEN next_date + (interval_count || ' years')::interval
        ELSE next_date + (interval_count || ' months')::interval
      END::date,
      post_count = post_count + 1,
      last_posted = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = due_item.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
-- Remove the SQL function since we'll use the API
DROP FUNCTION IF EXISTS process_due_scheduled_transactions();
