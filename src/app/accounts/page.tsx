"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Account, AccountType } from "@/types";

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "credit", "cash", "investment", "other"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "checking" as AccountType, balance: 0, currency: "USD" });
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    if (!supabaseRef.current) return;
    const { data } = await supabaseRef.current.from("accounts").select("*").order("created_at", { ascending: false });
    if (data) setAccounts(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;

    if (editingId) {
      await supabaseRef.current.from("accounts").update({
        name: formData.name,
        type: formData.type,
        currency: formData.currency,
        // Balance is NOT updated here — it's managed by transactions
      }).eq("id", editingId);
      setEditingId(null);
    } else {
      await supabaseRef.current.from("accounts").insert(formData);
    }

    setFormData({ name: "", type: "checking", balance: 0, currency: "USD" });
    setShowForm(false);
    fetchAccounts();
  }

  function startEdit(acc: Account) {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type as AccountType,
      balance: 0, // Don't expose balance editing directly
      currency: acc.currency,
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ name: "", type: "checking", balance: 0, currency: "USD" });
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!supabaseRef.current) return;
    if (confirm("Delete this account? All transactions will be deleted too.")) {
      await supabaseRef.current.from("accounts").delete().eq("id", id);
      fetchAccounts();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Accounts</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? "Cancel" : "+ Add Account"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Checking Account"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AccountType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="MXN">MXN ($)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                {editingId ? "Update Account" : "Create Account"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6">
          {accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 relative">
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => startEdit(acc)}
                      className="text-gray-400 hover:text-blue-500 transition text-xs"
                      title="Edit account"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                      title="Delete account"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">
                      {acc.type === "checking" ? "🏦" : acc.type === "savings" ? "🐷" : acc.type === "credit" ? "💳" : "💵"}
                    </span>
                    <span className="text-xs text-gray-500 uppercase">{acc.type}</span>
                  </div>
                  <p className="font-semibold text-gray-800">{acc.name}</p>
                  <p className={`text-xl font-bold ${Number(acc.balance) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">🏦</p>
              <p>No accounts yet. Create your first account to get started!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
