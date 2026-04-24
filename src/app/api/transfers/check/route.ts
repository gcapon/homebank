import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET ?transfer_id=xxx — check a specific transfer
// GET ?account_id=xxx — check all transfers for a specific account
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const transferId = searchParams.get("transfer_id");
  const accountId = searchParams.get("account_id");
  const monthKey = searchParams.get("month") || "2026-03";

  const supabase = await createClient();

  if (transferId) {
    // Check both sides of a specific transfer
    const { data, error } = await supabase
      .from("transactions")
      .select("*, accounts(name, type)")
      .eq("transfer_id", transferId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = data.map((tx: any) => {
      const counterpartyTx = data.find((t: any) => t.account_id !== tx.account_id);
      const counterpartyAcct = counterpartyTx
        ? { id: counterpartyTx.account_id, name: counterpartyTx.accounts?.name, type: counterpartyTx.accounts?.type }
        : null;
      return {
        txId: tx.id,
        accountId: tx.account_id,
        accountName: tx.accounts?.name,
        accountType: tx.accounts?.type,
        amount: tx.amount,
        date: tx.date,
        transferId: tx.transfer_id,
        counterpartyAcct,
        skipThisTx: counterpartyAcct?.type === "credit",
      };
    });

    return NextResponse.json(result);
  }

  if (accountId) {
    // Show all transfer transactions for one account in a given month
    const startDate = `${monthKey}-01`;
    const [year, month] = monthKey.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
    const { data, error } = await supabase
      .from("transactions")
      .select("*, accounts(name, type)")
      .eq("account_id", accountId)
      .not("transfer_id", "is", null)
      .gte("date", startDate)
      .lt("date", endDate);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = (data || []).map((tx: any) => {
      const counterpartyTx = data.find((t: any) => t.account_id !== tx.account_id && t.transfer_id === tx.transfer_id);
      const counterpartyAcct = counterpartyTx
        ? { id: counterpartyTx.account_id, name: counterpartyTx.accounts?.name, type: counterpartyTx.accounts?.type }
        : null;
      return {
        txId: tx.id,
        accountId: tx.account_id,
        accountName: tx.accounts?.name,
        accountType: tx.accounts?.type,
        amount: tx.amount,
        date: tx.date,
        transferId: tx.transfer_id,
        counterpartyAcct,
        wouldBeCounted: counterpartyAcct?.type !== "credit",
        skipThisTx: counterpartyAcct?.type === "credit",
      };
    });

    return NextResponse.json({
      month: monthKey,
      accountId,
      transactions: result,
      summary: {
        total: result.length,
        wouldBeCounted: result.filter((r: any) => r.wouldBeCounted).length,
        wouldBeSkipped: result.filter((r: any) => r.skipThisTx).length,
      },
    });
  }

  return NextResponse.json({ error: "pass transfer_id or account_id param" }, { status: 400 });
}
