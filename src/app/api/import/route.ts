import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';

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
  const file = formData.get('file') as File;
  const accountId = formData.get('accountId') as string;
  const dateCol = formData.get('dateCol') as string;
  const descCol = formData.get('descCol') as string;
  const amountCol = formData.get('amountCol') as string;

  if (!file || !accountId) {
    return NextResponse.json({ error: 'Missing file or account' }, { status: 400 });
  }

  const text = await file.text();
  const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });

  const transactions = (rows as any[]).map((row) => {
    const rawAmount = parseFloat(String(row[amountCol] || '0').replace(/[$,]/g, ''));
    const amount = isNaN(rawAmount) ? 0 : rawAmount;
    const dateStr = row[dateCol] || row['Date'] || row['date'] || '';
    let date = dateStr;

    // Try parsing various date formats
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().split('T')[0];
    }

    return {
      account_id: accountId,
      category_id: null,
      description: String(row[descCol] || row['Description'] || row['description'] || '').trim(),
      amount,
      date,
    };
  }).filter((t) => t.description && !isNaN(parseFloat(String(t.amount))));

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'No valid transactions found' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: data?.length || 0, transactions: data });
}
