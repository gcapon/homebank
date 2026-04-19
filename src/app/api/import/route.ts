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
  const typeCol = formData.get('typeCol') as string;

  if (!file || !accountId) {
    return NextResponse.json({ error: 'Missing file or account' }, { status: 400 });
  }

  const text = await file.text();
  const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });

  let importedCount = 0;
  let skippedCount = 0;

  for (const row of rows as any[]) {
    const rawAmount = parseFloat(String(row[amountCol] || '0').replace(/[$,]/g, ''));
    const amount = isNaN(rawAmount) ? 0 : rawAmount;
    const dateStr = row[dateCol] || row['Date'] || row['date'] || '';
    const description = String(row[descCol] || row['Description'] || row['description'] || '').trim();
    const txType = typeCol ? String(row[typeCol] || '').toLowerCase().trim() : 'income';

    let date = dateStr;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().split('T')[0];
    }

    if (!description || isNaN(amount)) {
      skippedCount++;
      continue;
    }

    let finalAmount = 0;
    if (txType === 'expense') {
      finalAmount = -Math.abs(amount);
    } else if (txType === 'income') {
      finalAmount = Math.abs(amount);
    } else {
      // transfer — skip or mark differently
      skippedCount++;
      continue;
    }

    const { error } = await supabase.from('transactions').insert({
      account_id: accountId,
      category_id: null,
      description,
      amount: finalAmount,
      date,
    });

    if (!error) importedCount++;
    else console.error('Import error:', error.message);
  }

  // Recalculate account balance from all transactions
  const { data: txList } = await supabase
    .from('transactions')
    .select('amount')
    .eq('account_id', accountId);

  const totalBalance = txList?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  await supabase.from('accounts').update({ balance: totalBalance }).eq('id', accountId);

  return NextResponse.json({ imported: importedCount, skipped: skippedCount });
}
