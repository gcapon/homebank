"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Account } from "@/types";

export default function TransfersPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  const [form, setForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    date: defaultDate,
    description: "",
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    const { data } = await supabase.from("accounts").select("*").order("name");
    if (data) setAccounts(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess("");

    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_account_id: form.from_account_id,
        to_account_id: form.to_account_id,
        amount: parseFloat(form.amount),
        date: form.date,
        description: form.description,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setSuccess("Transfer completed successfully!");
      setForm({ from_account_id: "", to_account_id: "", amount: "", date: defaultDate, description: "" });
      fetchAccounts(); // refresh balances
    } else {
      const err = await res.json();
      alert("Error: " + err.error);
    }
  }

  function handleSwap() {
    setForm((f) => ({ ...f, from_account_id: f.to_account_id, to_account_id: f.from_account_id }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800">↔️ Transfers</h2>
      <p className="text-gray-500 text-sm">Move money between accounts. No category needed — it's a direct account-to-account movement.</p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Account</label>
              <select
                required
                value={form.from_account_id}
                onChange={(e) => setForm({ ...form, from_account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (${Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleSwap}
                className="mx-auto px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 text-sm transition"
                title="Swap accounts"
              >
                ⇄ Swap
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
              <select
                required
                value={form.to_account_id}
                onChange={(e) => setForm({ ...form, to_account_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (${Number(a.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                required
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Credit card payment"
              />
            </div>
          </div>

          {success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
              ✅ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition disabled:opacity-50"
          >
            {loading ? "Processing..." : "Transfer Money"}
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">💡 How transfers work:</p>
        <ul className="space-y-1 text-blue-700">
          <li>• <strong>Paying a credit card</strong> from checking → select checking as "From", credit card as "To". Checking decreases, credit card debt reduces.</li>
          <li>• <strong>Moving to savings</strong> from checking → select checking as "From", savings as "To". Checking decreases, savings increases.</li>
          <li>• Transfers create two matched transactions linked by a shared ID.</li>
        </ul>
      </div>
    </div>
  );
}
