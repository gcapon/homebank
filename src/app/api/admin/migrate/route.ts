import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  // Add opening_balance column to accounts if it doesn't exist
  const { error } = await supabase.rpc("exec", {
    query: `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0;`,
  });

  // If rpc method doesn't work, try direct ALTER via a different approach
  if (error) {
    // Try raw SQL via a one-off update that simulates the column add
    // Use a workaround: update all rows to ensure column exists
    const { error: updateError } = await supabase
      .from("accounts")
      .update({ opening_balance: 0 })
      .eq("id", "00000000-0000-0000-0000-000000000000"); // won't match anything, but tests the column

    return NextResponse.json({
      attempted: true,
      column_add_error: error,
      update_test: updateError?.message || "ok",
    });
  }

  return NextResponse.json({ success: true, message: "Migration applied" });
}
