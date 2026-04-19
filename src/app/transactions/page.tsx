"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Account, Category } from "@/types";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    account_id: "",
    category_id: "",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [txResult, accResult, catResult] = await Promise.all([
      supabase.from("transactions").select("*, accounts(name), categories(name)").order("date", { ascending: false }),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    if (txResult.data) setTransactions(txResult.data);
    if (accResult.data) setAccounts(accResult.data);
    if (catResult.data) setCategories(catResult.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = formData.category_id ? -Math.abs(formData.amount) : formData.amount;
    await supabase.from("transactions").insert({ ...formData, amount });
    
    // Update account balance
    const account = accounts.find((a) => a.id === formData.account_id);
    if (account) {
      await supabase
        .from("accounts")
        .update({ balance: Number(account.balance) + amount })
        .eq("id", account.id);
    }
    
    setFormData({ account_id: "", category_id: "", description: "", amount: 0, date: new Date().toISOString().split("T")[0] });
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this transaction?")) {
      await supabase.from("transactions").delete().eq("id", id);
      fetchData();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Transactions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (optional)</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Income (no category)</option>
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
            <p className="text-xs text-gray-500">Leave category empty for income, or select one for an expense (will be stored as negative).</p>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              Add Transaction
            </button>
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
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Account</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    <th className="pb-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 text-sm text-gray-600">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).accounts?.name || "-"}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).categories?.name || "-"}</td>
                      <td className={`py-3 font-semibold text-right ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-center">
                        <button onClick={() => handleDelete(tx.id)} className="text-gray-400 hover:text-red-500 transition">✕</button>
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
