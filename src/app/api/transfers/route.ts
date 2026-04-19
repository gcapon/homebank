import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();
  const { from_account_id, to_account_id, amount, date, description } = body;

  if (!from_account_id || !to_account_id || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 400 });
  }

  // Generate a shared transfer_id to link the two transactions
  const transferId = crypto.randomUUID();
  const desc = description || "Transfer";

  // Fetch both account balances
  const { data: fromAcct, error: fromErr } = await supabase
    .from("accounts")
    .select("id, name, type, balance")
    .eq("id", from_account_id)
    .single();

  const { data: toAcct, error: toErr } = await supabase
    .from("accounts")
    .select("id, name, type, balance")
    .eq("id", to_account_id)
    .single();

  if (fromErr || !fromAcct) return NextResponse.json({ error: "From account not found" }, { status: 404 });
  if (toErr || !toAcct) return NextResponse.json({ error: "To account not found" }, { status: 404 });

  const absAmount = Math.abs(Number(amount));

  // Determine amounts:
  // from_account: amount is SUBTRACTED (outflow)
  // to_account: amount is ADDED (inflow)
  // Special case: credit cards stored as negative balance
  // When you pay a credit card (from checking to credit card), the credit card balance
  // goes from -500 to -300 (less negative = debt reduced = correct)
  // So we ADD to credit card (subtract a negative = add)

  const fromAmount = -absAmount;
  const toAmount = toAcct.type === "credit" ? absAmount : absAmount;

  const newFromBalance = Number(fromAcct.balance) + fromAmount;
  const newToBalance = Number(toAcct.balance) + toAmount;

  // Insert both transactions
  const { error: tx1Err } = await supabase.from("transactions").insert({
    account_id: from_account_id,
    description: `${desc} → ${toAcct.name}`,
    amount: fromAmount,
    date,
    transfer_id: transferId,
  });

  if (tx1Err) return NextResponse.json({ error: "Failed to create from transaction: " + tx1Err.message }, { status: 500 });

  const { error: tx2Err } = await supabase.from("transactions").insert({
    account_id: to_account_id,
    description: `${desc} ← ${fromAcct.name}`,
    amount: toAmount,
    date,
    transfer_id: transferId,
  });

  if (tx2Err) return NextResponse.json({ error: "Failed to create to transaction: " + tx2Err.message }, { status: 500 });

  // Update both account balances
  await supabase.from("accounts").update({ balance: newFromBalance }).eq("id", from_account_id);
  await supabase.from("accounts").update({ balance: newToBalance }).eq("id", to_account_id);

  return NextResponse.json({ success: true, transfer_id: transferId });
}
