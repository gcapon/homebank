"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { Account, Category, ScheduledTransaction } from "@/types";

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKEND_ACTIONS = [
  { value: "possible", label: "Don't care" },
  { value: "before", label: "Move to Friday" },
  { value: "after", label: "Move to Monday" },
];

export default function ScheduledPage() {
  const [items, setItems] = useState<(ScheduledTransaction & { accounts?: { name: string }; to_account?: { name: string } | null; categories?: { name: string } })[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [schedType, setSchedType] = useState<"expense" | "income" | "transfer">("expense");
  const [daysFilter, setDaysFilter] = useState<number>(60);
  const supabase = createSupabaseClient();

  // Post modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [postModalItem, setPostModalItem] = useState<typeof items[0] | null>(null);
  const [postModalOccurrenceDate, setPostModalOccurrenceDate] = useState<string>("");
  const [postForm, setPostForm] = useState({ description: "", amount: "", memo: "" });

  const [form, setForm] = useState({
    account_id: "",
    to_account_id: "",
    category_id: "",
    description: "",
    amount: "",
    memo: "",
    frequency: "monthly",
    interval_count: "1",
    day_of_week: "",
    day_of_month: "",
    week_of_month: "",
    weekend_action: "possible",
    next_date: "",
    max_posts: "",
    auto_post: false,
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [schedRes, acctRes, catRes] = await Promise.all([
      supabase.from("scheduled_transactions").select("*").order("next_date"),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (schedRes.data) {
      // Attach account/category names manually (can't use embedded select due to dual FK to accounts)
      const acctMap = Object.fromEntries((acctRes.data || []).map((a: any) => [a.id, a]));
      const catMap = Object.fromEntries((catRes.data || []).map((c: any) => [c.id, c]));
      const withNames = schedRes.data.map((s: any) => ({
        ...s,
        accounts: acctMap[s.account_id],
        to_account: s.to_account_id ? acctMap[s.to_account_id] : null,
        categories: catMap[s.category_id],
      }));
      setItems(withNames as any);
    }
    if (acctRes.data) setAccounts(acctRes.data);
    if (catRes.data) setCategories(catRes.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let amount = parseFloat(form.amount);
    if (schedType === "expense") amount = -Math.abs(amount);
    else amount = Math.abs(amount);

    const payload = {
      account_id: form.account_id,
      to_account_id: schedType === "transfer" ? form.to_account_id : null,
      category_id: schedType !== "transfer" ? (form.category_id || null) : null,
      description: form.description,
      amount,
      memo: form.memo,
      frequency: form.frequency,
      interval_count: parseInt(form.interval_count) || 1,
      day_of_week: form.day_of_week !== "" ? parseInt(form.day_of_week) : null,
      day_of_month: form.day_of_month !== "" ? parseInt(form.day_of_month) : null,
      week_of_month: form.week_of_month !== "" ? parseInt(form.week_of_month) : null,
      weekend_action: form.weekend_action,
      next_date: form.next_date,
      max_posts: form.max_posts ? parseInt(form.max_posts) : null,
      auto_post: form.auto_post,
    };

    if (editingId) {
      await supabase.from("scheduled_transactions").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editingId);
    } else {
      await supabase.from("scheduled_transactions").insert(payload);
    }
    resetForm();
    fetchData();
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setSchedType("expense");
    setForm({ account_id: "", to_account_id: "", category_id: "", description: "", amount: "", memo: "", frequency: "monthly", interval_count: "1", day_of_week: "", day_of_month: "", week_of_month: "", weekend_action: "possible", next_date: "", max_posts: "", auto_post: false });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this scheduled transaction?")) return;
    await supabase.from("scheduled_transactions").delete().eq("id", id);
    fetchData();
  }

  async function handlePostOccurrence(id: string, occurrenceDate: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setPostModalItem(item);
    setPostModalOccurrenceDate(occurrenceDate);
    setPostForm({ description: item.description, amount: String(Math.abs(Number(item.amount))), memo: item.memo || "" });
    setShowPostModal(true);
  }

  async function handleSkipOccurrence(id: string, occurrenceDate: string) {
    const res = await fetch("/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", id, occurrence_date: occurrenceDate }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      alert("Failed to skip: " + err.error);
    }
  }

  async function handlePost(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setPostModalItem(item);
    setPostModalOccurrenceDate("");
    setPostForm({ description: item.description, amount: String(Math.abs(Number(item.amount))), memo: item.memo || "" });
    setShowPostModal(true);
  }

  async function handleConfirmPost() {
    if (!postModalItem) return;
    const res = await fetch("/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "post",
        id: postModalItem.id,
        occurrence_date: postModalOccurrenceDate || postModalItem.next_date,
        // Override fields for this occurrence only
        description: postForm.description,
        amount: postForm.amount,
        memo: postForm.memo,
      }),
    });
    setShowPostModal(false);
    setPostModalItem(null);
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      alert("Failed to post: " + err.error);
    }
  }

  async function handleSkip(id: string) {
    const res = await fetch("/api/scheduled", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip", id }),
    });
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      alert("Failed to skip: " + err.error);
    }
  }

  function startEdit(item: typeof items[0]) {
    setEditingId(item.id);
    const isTransfer = !!item.to_account_id;
    setSchedType(isTransfer ? "transfer" : Number(item.amount) < 0 ? "expense" : "income");
    setForm({
      account_id: item.account_id || "",
      to_account_id: item.to_account_id || "",
      category_id: item.category_id || "",
      description: item.description || "",
      amount: String(Math.abs(item.amount)),
      memo: item.memo || "",
      frequency: item.frequency || "monthly",
      interval_count: String(item.interval_count || 1),
      day_of_week: item.day_of_week != null ? String(item.day_of_week) : "",
      day_of_month: item.day_of_month != null ? String(item.day_of_month) : "",
      week_of_month: item.week_of_month != null ? String(item.week_of_month) : "",
      weekend_action: item.weekend_action || "possible",
      next_date: item.next_date || "",
      max_posts: item.max_posts ? String(item.max_posts) : "",
      auto_post: item.auto_post || false,
    });
    setShowForm(true);
  }


  function isDue(item: typeof items[0]) {
    const today = new Date().toISOString().split("T")[0];
    return (item.active !== false) && item.next_date && item.next_date <= today;
  }

  function computeOccurrences(sched: typeof items[0], maxDays: number): string[] {
    const occurrences: string[] = [];
    let current = new Date(sched.next_date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + maxDays);

    for (let i = 0; i < 200; i++) {
      // safety cap
      if (current > end) break;
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      occurrences.push(`${yyyy}-${mm}-${dd}`);

      const next = advanceDate(
        `${yyyy}-${mm}-${dd}`,
        sched.frequency,
        sched.interval_count,
        sched.day_of_week,
        sched.day_of_month,
        sched.week_of_month,
        sched.weekend_action
      );
      current = new Date(next + "T00:00:00");
    }
    return occurrences;
  }

  function advanceDate(currentDate: string, frequency: string, intervalCount: number, dayOfWeek: number | null, dayOfMonth: number | null, weekOfMonth: number | null, weekendAction: string): string {
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
          d.setMonth(d.getMonth() + intervalCount);
          d.setDate(1);
          let count = 0;
          while (count < weekOfMonth) {
            if (d.getDay() === dayOfWeek) count++;
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

  function frequencyLabel(item: typeof items[0]) {
    if (!item.frequency) return "—";
    const int = item.interval_count || 1;
    const unit = item.frequency === "daily" ? "day" : item.frequency === "weekly" ? "week" : item.frequency === "monthly" ? "month" : "year";
    if (item.frequency === "monthly" && item.week_of_month != null && item.day_of_week != null) {
      const ordinal = ["1st", "2nd", "3rd", "4th", "5th"][item.week_of_month - 1];
      return `Every ${ordinal} ${WEEKDAYS[item.day_of_week]}`;
    }
    if (item.frequency === "monthly" && item.day_of_month != null) {
      return `Monthly on day ${item.day_of_month}`;
    }
    return `Every ${int} ${int === 1 ? unit : unit + "s"}`;
  }

  // Build expanded occurrence list for upcoming view
  const allOccurrences: (typeof items[0] & { occurrenceDate: string })[] = [];
  const today = new Date().toISOString().split("T")[0];
  for (const item of items) {
    if (!item.active) continue;
    // Guard against NULL frequency — use a safe default for old records
    const freq = item.frequency || "monthly";
    const intCount = item.interval_count || 1;
    const occs = computeOccurrences({ ...item, frequency: freq, interval_count: intCount }, daysFilter === 999 ? 365 : daysFilter);
    for (const occ of occs) {
      if (occ < today) continue; // skip past
      allOccurrences.push({ ...item, occurrenceDate: occ });
    }
  }
  // Sort by occurrence date
  allOccurrences.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));

  const dueItems = items.filter((i) => isDue(i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">🔄 Scheduled Transactions</h2>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {showForm ? "Cancel" : "+ New Scheduled"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">{editingId ? "Edit Scheduled Transaction" : "New Scheduled Transaction"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div className="flex gap-2 mb-2">
              {(["expense", "income", "transfer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSchedType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    schedType === t
                      ? t === "expense" ? "bg-red-100 text-red-700 border-2 border-red-300"
                        : t === "income" ? "bg-green-100 text-green-700 border-2 border-green-300"
                        : "bg-blue-100 text-blue-700 border-2 border-blue-300"
                      : "bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  {t === "expense" ? "💸 Expense" : t === "income" ? "💰 Income" : "↔️ Transfer/Payment"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {schedType === "transfer" ? "From Account *" : "Account *"}
                </label>
                <select required value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {schedType === "transfer" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">To Account *</label>
                  <select required value={form.to_account_id} onChange={(e) => setForm({ ...form, to_account_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Select account</option>
                    {accounts.filter((a) => a.id !== form.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Category {schedType === "income" ? "(optional)" : ""}</label>
                  <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">{schedType === "income" ? "No category (income)" : "None"}</option>
                    {categories.filter((c) => schedType === "income" ? c.type === "income" : c.type === "expense").map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description *</label>
                <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount *</label>
                <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Frequency</label>
                <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Every X</label>
                <input type="number" min="1" value={form.interval_count} onChange={(e) => setForm({ ...form, interval_count: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Weekend handling</label>
                <select value={form.weekend_action} onChange={(e) => setForm({ ...form, weekend_action: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  {WEEKEND_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>

            {form.frequency === "monthly" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Day of month (1-31)</label>
                  <input type="number" min="1" max="31" value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} placeholder="e.g., 15 for 15th" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Week # (1st, 2nd...)</label>
                    <input type="number" min="1" max="5" value={form.week_of_month} onChange={(e) => setForm({ ...form, week_of_month: e.target.value })} placeholder="1-5" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Weekday</label>
                    <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Pick...</option>
                      {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Next occurrence *</label>
                <input required type="date" value={form.next_date} onChange={(e) => setForm({ ...form, next_date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Max posts (blank = unlimited)</label>
                <input type="number" min="1" value={form.max_posts} onChange={(e) => setForm({ ...form, max_posts: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.auto_post} onChange={(e) => setForm({ ...form, auto_post: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-gray-700">Auto-post when due</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">{editingId ? "Update" : "Create"}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {dueItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="font-bold text-red-700 mb-3">⚠️ Due Now ({dueItems.length})</h3>
          <div className="space-y-2">
            {dueItems.map((item) => (
              <div key={item.id} className={`flex items-center justify-between rounded-lg px-4 py-3 shadow-sm ${Number(item.amount) > 0 && !item.to_account_id ? "bg-green-50" : "bg-white"}`}>
                <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                  <div>
                    <div className="font-medium text-gray-800">{item.description}</div>
                    <div className="text-xs text-gray-500">{item.accounts?.name}{item.to_account ? ` → ${item.to_account.name}` : ""}</div>
                  </div>
                  <div className="text-right font-semibold text-gray-700">${Math.abs(Number(item.amount)).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{frequencyLabel(item)}</div>
                  <div className="text-base text-red-500 font-semibold">Due: {item.next_date}</div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handlePost(item.id)} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">Post</button>
                  <button onClick={() => handleSkip(item.id)} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200">Skip</button>
                  <button onClick={() => startEdit(item)} className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post Confirmation Modal */}
      {showPostModal && postModalItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Confirm Post</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Account</span>
                  <span className="text-sm font-medium text-gray-800">{postModalItem.accounts?.name}</span>
                </div>
                {postModalItem.to_account_id && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">To Account</span>
                    <span className="text-sm font-medium text-gray-800">{postModalItem.to_account?.name}</span>
                  </div>
                )}
                {postModalItem.category_id && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Category</span>
                    <span className="text-sm font-medium text-gray-800">{postModalItem.categories?.name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Date</span>
                  <input
                    type="date"
                    value={postModalOccurrenceDate}
                    onChange={e => setPostModalOccurrenceDate(e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-sm font-medium text-gray-800"
                  />
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="text-lg font-bold text-gray-800">${postForm.amount}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={postForm.description}
                  onChange={e => setPostForm({ ...postForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={postForm.amount}
                  onChange={e => setPostForm({ ...postForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Memo (optional)</label>
                <input
                  type="text"
                  value={postForm.memo}
                  onChange={e => setPostForm({ ...postForm, memo: e.target.value })}
                  placeholder="Add a note for this occurrence only"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <p className="text-xs text-gray-400">
                Only edits this occurrence. The scheduled transaction remains unchanged for future dates.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleConfirmPost}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Post Transaction
              </button>
              <button
                onClick={() => { setShowPostModal(false); setPostModalItem(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming filter bar */}
      <div className="flex items-center gap-4 mb-3">
        <h3 className="text-lg font-semibold text-gray-700">Upcoming Scheduled</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { label: "7 days", value: 7 },
            { label: "30 days", value: 30 },
            { label: "60 days", value: 60 },
            { label: "All", value: 999 },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDaysFilter(opt.value)}
              className={`px-3 py-1 text-sm rounded-md transition ${
                daysFilter === opt.value
                  ? "bg-white shadow text-blue-600 font-medium"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400">{allOccurrences.length} occurrences</span>
      </div>

      <div>
        {allOccurrences.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No upcoming scheduled transactions in the next {daysFilter === 999 ? "year" : daysFilter + " days"}.
          </div>
        ) : (
          <div className="space-y-2">
            {allOccurrences.map((item) => (
              <div key={`${item.id}-${item.occurrenceDate}`} className={`flex items-center justify-between rounded-lg px-4 py-3 shadow-sm border-l-4 ${Number(item.amount) > 0 && !item.to_account_id ? "border-green-400 bg-green-50" : "border-blue-400 bg-white"}`}>
                <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                  <div>
                    <div className="font-medium text-gray-800">{item.description}</div>
                    <div className="text-xs text-gray-500">{item.accounts?.name}{item.to_account ? ` → ${item.to_account.name}` : item.categories ? ` → ${item.categories.name}` : ""}</div>
                  </div>
                  <div className="text-right font-semibold text-gray-700">${Math.abs(Number(item.amount)).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{frequencyLabel(item)}</div>
                  <div className="text-base text-blue-600 font-semibold">{item.occurrenceDate}</div>
                  <div className="text-xs text-gray-400">
                    {item.auto_post ? "🔁 Auto" : "👆 Manual"} · {item.post_count} posted
                    {item.max_posts ? ` / ${item.max_posts}` : ""}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => handlePostOccurrence(item.id, item.occurrenceDate)} className="px-3 py-1 bg-green-50 text-green-600 text-sm rounded hover:bg-green-100">Post</button>
                  <button onClick={() => handleSkipOccurrence(item.id, item.occurrenceDate)} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200">Skip</button>
                  <button onClick={() => startEdit(item)} className="px-3 py-1 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
