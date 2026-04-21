import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  // Check if apr and notes columns exist
  const { data: columnsData, error: columnsError } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_name", "accounts");

  if (columnsError) {
    return NextResponse.json({ error: "Cannot check columns", details: columnsError.message }, { status: 500 });
  }

  const colNames = (columnsData || []).map((c: any) => c.column_name);
  const hasApr = colNames.includes("apr");
  const hasNotes = colNames.includes("notes");

  if (hasApr && hasNotes) {
    return NextResponse.json({ success: true, message: "Columns already exist" });
  }

  // Try to add columns via a workaround: we'll do a dummy update that would fail if columns don't exist
  // Then return what needs to be done manually
  
  return NextResponse.json({
    migration_needed: true,
    missing_columns: [
      ...(hasApr ? [] : ["apr"]),
      ...(hasNotes ? [] : ["notes"]),
    ],
    instructions: "Run these SQL commands in Supabase SQL Editor:\nALTER TABLE accounts ADD COLUMN IF NOT EXISTS apr NUMERIC(5,3) DEFAULT NULL;\nALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;"
  });
}