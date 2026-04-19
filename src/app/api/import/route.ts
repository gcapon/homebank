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
  const accountCol = formData.get('accountCol') as string;
  const dateCol = formData.get('dateCol') as string;
  const descCol = formData.get('descCol') as string;
  const amountCol = formData.get('amountCol') as string;
  const typeCol = formData.get('typeCol') as string;
  const memoCol = formData.get('memoCol') as string;

  if (!file || !dateCol || !descCol || !amountCol) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const text = await file.text();
  const { data: rows } = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });

  // Build account map (name -> id) and auto-create missing accounts
  const { data: existingAccounts } = await supabase.from('accounts').select('id, name');
  const accountMap = new Map<string, string>();
  const accountNameToType = new Map<string, string>();
  for (const acc of existingAccounts || []) {
    accountMap.set(acc.name.toLowerCase(), acc.id);
    accountNameToType.set(acc.name.toLowerCase(), 'checking');
  }

  // Fetch all categories for type detection
  const { data: categories } = await supabase.from('categories').select('id, name, type');
  const categoryMap = new Map<string, string>();
  for (const cat of categories || []) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  }

  let importedCount = 0;
  let skippedCount = 0;
  const accountBalances = new Map<string, number>();

  for (const row of rows as any[]) {
    const rawAmount = parseFloat(String(row[amountCol] || '0').replace(/[$,]/g, ''));
    const amount = isNaN(rawAmount) ? 0 : rawAmount;
    const dateStr = row[dateCol] || '';
    const description = String(row[descCol] || '').trim();
    const txType = typeCol ? String(row[typeCol] || '').toLowerCase().trim() : 'income';
    const memo = memoCol ? String(row[memoCol] || '').trim() : '';

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
      // transfer — skip
      skippedCount++;
      continue;
    }

    // Resolve account
    let accountId: string | null = null;
    const accountNameRaw = accountCol ? String(row[accountCol] || '').trim() : '';
    if (accountCol && accountNameRaw) {
      const accountNameKey = accountNameRaw.toLowerCase();
      if (accountMap.has(accountNameKey)) {
        accountId = accountMap.get(accountNameKey)!;
      } else {
        // Auto-create account
        const { data: newAcc, error: accErr } = await supabase
          .from('accounts')
          .insert({ name: accountNameRaw, type: 'checking', balance: 0, opening_balance: 0 })
          .select('id')
          .single();
        if (!accErr && newAcc && newAcc.id) {
          accountId = newAcc.id;
          accountMap.set(accountNameKey, newAcc.id);
        }
      }
    }

    if (!accountId) {
      skippedCount++;
      continue;
    }

    // Resolve category (match by description keyword or default)
    let categoryId: string | null = null;
    const descLower = description.toLowerCase();
    for (const [catName, catId] of categoryMap.entries()) {
      if (descLower.includes(catName)) {
        categoryId = catId;
        break;
      }
    }

    const { error } = await supabase.from('transactions').insert({
      account_id: accountId,
      category_id: categoryId,
      description,
      amount: finalAmount,
      date,
      memo,
    });

    if (!error) {
      importedCount++;
      // Track per-account balance
      accountBalances.set(accountId, (accountBalances.get(accountId) || 0) + finalAmount);
    } else {
      console.error('Import error:', error.message);
      skippedCount++;
    }
  }

  // Update each affected account's balance
  for (const [accId, delta] of accountBalances) {
    const { data: acc } = await supabase.from('accounts').select('balance, opening_balance').eq('id', accId).single();
    if (acc) {
      const newBalance = Number(acc.balance) + delta;
      await supabase.from('accounts').update({ balance: newBalance }).eq('id', accId);
    }
  }

  return NextResponse.json({ imported: importedCount, skipped: skippedCount });
}
