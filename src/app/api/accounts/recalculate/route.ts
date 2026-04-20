import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

  const { accountId } = await request.json();
  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
  }

  // Sum all non-transfer transactions for this account
  const { data: txns } = await supabase
    .from('transactions')
    .select('amount')
    .eq('account_id', accountId)
    .is('transfer_id', null);

  const sum = (txns || []).reduce((acc, t) => acc + Number(t.amount), 0);

  // Update the account's balance column
  await supabase
    .from('accounts')
    .update({ balance: sum })
    .eq('id', accountId);

  return NextResponse.json({ accountId, calculatedBalance: sum });
}