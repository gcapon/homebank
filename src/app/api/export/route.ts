import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const [accounts, categories, transactions, scheduled, budgets] = await Promise.all([
    supabase.from("accounts").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("scheduled_transactions").select("*").order("next_date"),
    supabase.from("budgets").select("*").order("month"),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    version: "1.0",
    accounts: accounts.data || [],
    categories: categories.data || [],
    transactions: transactions.data || [],
    scheduled_transactions: scheduled.data || [],
    budgets: budgets.data || [],
  };

  return NextResponse.json(exportData);
}
