import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const transferId = searchParams.get("transfer_id");

  if (!transferId) {
    return NextResponse.json({ error: "Missing transfer_id param" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, accounts(name, type)")
    .eq("transfer_id", transferId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
