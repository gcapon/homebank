"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Account, AccountType } from "@/types";

const ACCOUNT_TYPES: AccountType[] = ["checking", "savings", "credit", "cash", "investment", "other"];

const ASSET_TYPES = ["checking", "savings", "cash", "investment", "other"];
const LIABILITY_TYPES = ["credit"];

function getAccountLabel(type: string) {
  if (type === "credit") return "Liability";
  if (type === "checking") return "Asset";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getAccountIcon(type: string) {
  if (type === "checking") return "🏦";
  if (type === "savings") return "🐷";
  if (type === "credit") return "💳";
  if (type === "cash") return "💵";
  if (type === "investment") return "📈";
  return "📦";
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "checking" as AccountType, opening_balance: 0, currency: "USD", apr: "", notes: "" });
  const [currentBalances, setCurrentBalances] = useState<Record<string, number>>({});
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    fetchAccounts();
    fetchBalances();
  }, []);

  async function fetchBalances() {
    try {
      const res = await fetch("/api/accounts/current-balances");
      if (res.ok) {
        const data = await res.json();
        setCurrentBalances(data);
      }
    } catch (e) {
      console.error("Failed to fetch balances", e);
    }
  }

  async function fetchAccounts() {
    if (!supabaseRef.current) return;
    const { data } = await supabaseRef.current.from("accounts").select("*").order("created_at", { ascending: false });
    if (data) setAccounts(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;

    if (editingId) {
      // Balance is calculated: sum of transactions + opening_balance. Update opening_balance only.
      await supabaseRef.current.from("accounts").update({
        name: formData.name,
        type: formData.type,
        currency: formData.currency,
        opening_balance: formData.opening_balance,
        apr: formData.apr ? parseFloat(formData.apr) : null,
        notes: formData.notes || null,
      }).eq("id", editingId);
      setEditingId(null);
    } else {
      // Opening balance for new account; balance starts same as opening balance
      const initialBalance = formData.type === "credit" ? -Math.abs(formData.opening_balance) : formData.opening_balance;
      await supabaseRef.current.from("accounts").insert({ ...formData, balance: initialBalance, apr: formData.apr ? parseFloat(formData.apr) : null, notes: formData.notes || null });
    }

    setFormData({ name: "", type: "checking", opening_balance: 0, currency: "USD", apr: "", notes: "" });
    setShowForm(false);
    fetchAccounts();
    fetchBalances();
  }

  function startEdit(acc: Account) {
    console.log("startEdit called", acc.id, acc.name);
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type as AccountType,
      opening_balance: Number(acc.opening_balance),
      currency: acc.currency,
      apr: acc.apr != null ? String(acc.apr) : "",
      notes: acc.notes || "",
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ name: "", type: "checking", opening_balance: 0, currency: "USD", apr: "", notes: "" });
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
        <h2 className="text-2xl font-bold text-gray-800">Accounts & Current Balances</h2>
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
                      {getAccountLabel(type)}
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
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Current balance is calculated from transactions</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">APR % (optional)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  value={formData.apr}
                  onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 24.99"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Any notes about this account..."
                />
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
              {(
                [
                  ...accounts
                    .filter((a) => ASSET_TYPES.includes(a.type))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                  ...accounts
                    .filter((a) => LIABILITY_TYPES.includes(a.type))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                ]
              ).map((acc) => (
                <div key={acc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getAccountIcon(acc.type)}</span>
                      <span className="text-xs text-gray-500">{getAccountLabel(acc.type)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startEdit(acc)}
                        className="text-gray-400 hover:text-blue-500 transition text-sm"
                        title="Edit account"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="text-gray-400 hover:text-red-500 transition text-sm"
                        title="Delete account"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-800 text-base">{acc.name}</p>
                  {acc.apr != null && (
                    <p className="text-sm text-gray-500">APR: {Number(acc.apr).toFixed(2)}%</p>
                  )}
                  {acc.notes && (
                    <p className="text-sm text-gray-400 italic truncate">{acc.notes}</p>
                  )}
                  <p className={`text-xl font-bold ${(currentBalances[acc.id] || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${(currentBalances[acc.id] || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
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
