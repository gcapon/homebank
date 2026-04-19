import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scheduled_transactions")
    .select("*, accounts(name), categories(name)")
    .order("next_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json();

  // If action is "post" or "skip", handle specially
  if (body.action === "post" || body.action === "skip") {
    const { id, action } = body;
    const sched = await supabase
      .from("scheduled_transactions")
      .select("*, accounts(id, name, type, balance)")
      .eq("id", id)
      .single();

    if (sched.error || !sched.data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const s = sched.data;

    if (action === "post") {
      // Create the actual transaction
      const { error: txError } = await supabase.from("transactions").insert({
        account_id: s.account_id,
        category_id: s.category_id,
        description: s.description,
        amount: s.amount,
        date: new Date().toISOString().split("T")[0],
        memo: s.memo || "",
      });

      if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

      // Update account balance
      const newBalance = Number(s.accounts?.balance ?? 0) + Number(s.amount);
      const { error: balError } = await supabase
        .from("accounts")
        .update({ balance: newBalance })
        .eq("id", s.account_id);
      if (balError) return NextResponse.json({ error: "Balance update failed: " + balError.message }, { status: 500 });
    }

    // Advance to next date
    const nextDate = computeNextDate(
      s.next_date,
      s.frequency,
      s.interval_count,
      s.day_of_week,
      s.day_of_month,
      s.week_of_month,
      s.weekend_action
    );

    const newPostCount = s.post_count + 1;
    const updates: Record<string, unknown> = {
      next_date: nextDate,
      post_count: newPostCount,
      last_posted: action === "post" ? new Date().toISOString().split("T")[0] : s.last_posted,
      updated_at: new Date().toISOString(),
    };

    // Check if we've hit max posts
    if (s.max_posts && newPostCount >= s.max_posts) {
      updates.active = false;
    }

    const { error: updError } = await supabase
      .from("scheduled_transactions")
      .update(updates)
      .eq("id", id);

    if (updError) return NextResponse.json({ error: updError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Normal create
  const { data, error } = await supabase
    .from("scheduled_transactions")
    .insert({
      account_id: body.account_id,
      category_id: body.category_id,
      description: body.description || "",
      amount: body.amount,
      memo: body.memo || "",
      frequency: body.frequency || "monthly",
      interval_count: body.interval_count || 1,
      day_of_week: body.day_of_week,
      day_of_month: body.day_of_month,
      week_of_month: body.week_of_month,
      weekend_action: body.weekend_action || "possible",
      next_date: body.next_date,
      max_posts: body.max_posts,
      auto_post: body.auto_post || false,
      active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const body = await req.json();
  const { id, ...updates } = body;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("scheduled_transactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await supabase.from("scheduled_transactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

function computeNextDate(
  currentDate: string,
  frequency: string,
  intervalCount: number,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  weekOfMonth: number | null,
  weekendAction: string
): string {
  const d = new Date(currentDate + "T00:00:00");

  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + intervalCount);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * intervalCount);
      break;
    case "monthly":
      if (weekOfMonth != null && dayOfWeek != null) {
        // "1st Monday", "2nd Friday" style
        d.setMonth(d.getMonth() + intervalCount);
        d.setDate(1);
        let count = 0;
        const targetDay = dayOfWeek;
        while (count < weekOfMonth) {
          if (d.getDay() === targetDay) count++;
          if (count < weekOfMonth) d.setDate(d.getDate() + 1);
        }
      } else if (dayOfMonth != null) {
        d.setMonth(d.getMonth() + intervalCount);
        d.setDate(dayOfMonth);
      } else {
        d.setMonth(d.getMonth() + intervalCount);
      }
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + intervalCount);
      break;
    default:
      d.setMonth(d.getMonth() + intervalCount);
  }

  // Weekend handling
  const day = d.getDay();
  if (day === 0 && weekendAction === "after") d.setDate(d.getDate() + 1);
  else if (day === 0 && weekendAction === "before") d.setDate(d.getDate() - 1);
  else if (day === 6 && weekendAction === "after") d.setDate(d.getDate() + 2);
  else if (day === 6 && weekendAction === "before") d.setDate(d.getDate() - 1);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
