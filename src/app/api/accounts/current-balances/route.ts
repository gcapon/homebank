import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Returns computed current balances for all accounts
// balance = opening_balance + SUM(amount) of all transactions for that account
export async function GET() {
  const supabase = await createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  const { data: accounts } = await supabase.from("accounts").select("id, opening_balance");
  const { data: transactions } = await supabase.from("transactions").select("account_id, amount");

  if (!accounts) return NextResponse.json({});

  const balanceMap: Record<string, number> = {};

  for (const acc of accounts) {
    const txSum = (transactions || [])
      .filter((t) => t.account_id === acc.id)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    balanceMap[acc.id] = Number(acc.opening_balance || 0) + txSum;
  }

  return NextResponse.json(balanceMap);
}
