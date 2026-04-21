import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  console.log("card-budget API hit:", request.method);
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

  console.log("card-budget params:", { accountId, month, amount });

  if (!accountId || !month) {
    return NextResponse.json({ error: 'accountId and month required' }, { status: 400 });
  }

  // Upsert
  const { data: existing, error: selectError } = await supabase
    .from('card_budgets')
    .select('id')
    .eq('account_id', accountId)
    .eq('month', month)
    .single();

  console.log("existing lookup:", existing, selectError);

  if (selectError && selectError.code !== 'PGRST116') {
    console.error("Select error:", selectError);
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (existing) {
    const { error } = await supabase.from('card_budgets').update({ amount }).eq('id', existing.id);
    if (error) {
      console.error("Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from('card_budgets').insert({ account_id: accountId, month, amount });
    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
