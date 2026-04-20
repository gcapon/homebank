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

  const formData = await request.formData();
  const accountId = formData.get('accountId') as string;
  const month = formData.get('month') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  if (!accountId || !month) {
    return NextResponse.json({ error: 'accountId and month required' }, { status: 400 });
  }

  // Upsert
  const { data: existing } = await supabase
    .from('card_budgets')
    .select('id')
    .eq('account_id', accountId)
    .eq('month', month)
    .single();

  if (existing) {
    await supabase.from('card_budgets').update({ amount }).eq('id', existing.id);
  } else {
    await supabase.from('card_budgets').insert({ account_id: accountId, month, amount });
  }

  return NextResponse.json({ ok: true });
}