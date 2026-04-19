"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Transaction, Account, Category } from "@/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  const [formData, setFormData] = useState({
    account_id: "",
    category_id: "",
    description: "",
    amount: 0,
    date: defaultDate,
  });
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabaseRef.current) return;
    const [txResult, accResult, catResult] = await Promise.all([
      supabaseRef.current.from("transactions").select("*, accounts(name), categories(name)").order("date", { ascending: false }),
      supabaseRef.current.from("accounts").select("*").order("name"),
      supabaseRef.current.from("categories").select("*").order("name"),
    ]);
    if (txResult.data) setTransactions(txResult.data);
    if (accResult.data) setAccounts(accResult.data);
    if (catResult.data) setCategories(catResult.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;

    // Determine sign based on category type, not just whether category is selected
    let amount = formData.amount;
    if (formData.category_id) {
      const category = categories.find((c) => c.id === formData.category_id);
      if (category?.type === "expense") {
        amount = -Math.abs(amount); // expenses are negative
      } else {
        amount = Math.abs(amount); // income is positive
      }
    } else {
      // No category selected — user should specify via income toggle
      // For now treat as income (positive)
      amount = Math.abs(amount);
    }

    if (editingId) {
      // Get old transaction to adjust balance
      const oldTx = transactions.find((t) => t.id === editingId);
      const oldAmount = oldTx ? Number(oldTx.amount) : 0;

      await supabaseRef.current.from("transactions").update({
        account_id: formData.account_id,
        category_id: formData.category_id || null,
        description: formData.description,
        amount,
        date: formData.date,
      }).eq("id", editingId);

      // Adjust account balances
      const oldAccount = accounts.find((a) => a.id === oldTx?.account_id);
      const newAccount = accounts.find((a) => a.id === formData.account_id);

      if (oldAccount) {
        await supabaseRef.current.from("accounts")
          .update({ balance: Number(oldAccount.balance) - oldAmount })
          .eq("id", oldAccount.id);
      }
      if (newAccount) {
        await supabaseRef.current.from("accounts")
          .update({ balance: Number(newAccount.balance) + amount })
          .eq("id", newAccount.id);
      }

      setEditingId(null);
    } else {
      await supabaseRef.current.from("transactions").insert({
        account_id: formData.account_id,
        category_id: formData.category_id || null,
        description: formData.description,
        amount,
        date: formData.date,
      });

      // Update account balance
      const account = accounts.find((a) => a.id === formData.account_id);
      if (account) {
        await supabaseRef.current.from("accounts")
          .update({ balance: Number(account.balance) + amount })
          .eq("id", account.id);
      }
    }

    setFormData({ account_id: "", category_id: "", description: "", amount: 0, date: defaultDate });
    setShowForm(false);
    fetchData();
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setFormData({
      account_id: tx.account_id,
      category_id: tx.category_id || "",
      description: tx.description,
      amount: Math.abs(Number(tx.amount)),
      date: tx.date,
    });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ account_id: "", category_id: "", description: "", amount: 0, date: defaultDate });
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!supabaseRef.current) return;
    if (confirm("Delete this transaction?")) {
      const tx = transactions.find((t) => t.id === id);
      const account = accounts.find((a) => a.id === tx?.account_id);
      if (account && tx) {
        await supabaseRef.current.from("accounts")
          .update({ balance: Number(account.balance) - Number(tx.amount) })
          .eq("id", account.id);
      }
      await supabaseRef.current.from("transactions").delete().eq("id", id);
      fetchData();
    }
  }

  async function handleReconcile(id: string, reconciled: boolean) {
    if (!supabaseRef.current) return;
    // Optimistic update — update local state immediately, no refetch
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, reconciled } : tx))
    );
    await supabaseRef.current.from("transactions").update({ reconciled }).eq("id", id);
  }

  const filteredTransactions = selectedAccountId
    ? transactions.filter((tx) => tx.account_id === selectedAccountId)
    : transactions;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Transactions</h2>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} (${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            if (selectedAccountId && !editingId) {
              setFormData({ ...formData, account_id: selectedAccountId });
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? "Cancel" : "+ Add Transaction"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Category (for expense)</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Grocery shopping"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Select an <strong>expense category</strong> to make it negative. Select an <strong>income category</strong> (or none) to make it positive.
            </p>
            <div className="flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                {editingId ? "Update Transaction" : "Add Transaction"}
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
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium w-10"></th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Account</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={tx.reconciled}
                          onChange={() => handleReconcile(tx.id, !tx.reconciled)}
                          className="w-4 h-4 rounded cursor-pointer accent-green-600"
                          title={tx.reconciled ? "Reconciled — click to unmark" : "Mark as reconciled"}
                        />
                      </td>
                      <td className="py-3 text-sm text-gray-600">{tx.date}</td>
                      <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).accounts?.name || "-"}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).categories?.name || "-"}</td>
                      <td className={`py-3 font-semibold text-right ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-center flex gap-2 justify-end">
                        <button onClick={() => startEdit(tx)} className="text-blue-400 hover:text-blue-600 text-xs">Edit</button>
                        <button onClick={() => handleDelete(tx.id)} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">💸</p>
              <p>No transactions yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
