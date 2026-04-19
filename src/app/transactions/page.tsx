"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Transaction, Account, Category } from "@/types";

type TxType = "expense" | "income" | "transfer";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [transactionType, setTransactionType] = useState<TxType>("expense");
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  const [formData, setFormData] = useState({
    account_id: "",
    to_account_id: "",
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

    if (transactionType === "transfer") {
      // Use the transfer API
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_account_id: formData.account_id,
          to_account_id: formData.to_account_id,
          amount: Math.abs(formData.amount),
          date: formData.date,
          description: formData.description,
        }),
      });
      if (res.ok) {
        setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, date: defaultDate });
        setShowForm(false);
        fetchData();
      } else {
        const err = await res.json();
        alert("Error: " + err.error);
      }
      return;
    }

    // Expense or Income
    let amount = Math.abs(formData.amount);
    if (transactionType === "expense" && formData.category_id) {
      const category = categories.find((c) => c.id === formData.category_id);
      if (category?.type === "expense") {
        amount = -Math.abs(amount);
      }
    } else if (transactionType === "expense" && !formData.category_id) {
      amount = -Math.abs(amount);
    }

    if (editingId) {
      const oldTx = transactions.find((t) => t.id === editingId);
      const oldAmount = oldTx ? Number(oldTx.amount) : 0;

      await supabaseRef.current.from("transactions").update({
        account_id: formData.account_id,
        category_id: formData.category_id || null,
        description: formData.description,
        amount,
        date: formData.date,
      }).eq("id", editingId);

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

      const account = accounts.find((a) => a.id === formData.account_id);
      if (account) {
        await supabaseRef.current.from("accounts")
          .update({ balance: Number(account.balance) + amount })
          .eq("id", account.id);
      }
    }

    setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, date: defaultDate });
    setShowForm(false);
    fetchData();
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    const isTransfer = tx.transfer_id;
    if (isTransfer) {
      setTransactionType("transfer");
      // transfers have two tx with same transfer_id — show the pair info in description
      setFormData({
        account_id: tx.account_id,
        to_account_id: "",
        category_id: "",
        description: tx.description,
        amount: Math.abs(Number(tx.amount)),
        date: tx.date,
      });
    } else {
      setTransactionType(Number(tx.amount) < 0 ? "expense" : "income");
      setFormData({
        account_id: tx.account_id,
        to_account_id: "",
        category_id: tx.category_id || "",
        description: tx.description,
        amount: Math.abs(Number(tx.amount)),
        date: tx.date,
      });
    }
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, date: defaultDate });
    setShowForm(false);
    setTransactionType("expense");
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
            setTransactionType("expense");
            if (selectedAccountId) {
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
            {/* Type selector */}
            <div className="flex gap-2 mb-2">
              {(["expense", "income", "transfer"] as TxType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTransactionType(t); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    transactionType === t
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {transactionType === "transfer" ? "From Account" : "Account"}
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Account</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {transactionType === "transfer" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Account</label>
                  <select
                    value={formData.to_account_id}
                    onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Account</option>
                    {accounts.filter((a) => a.id !== formData.account_id).map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {transactionType !== "transfer" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category {transactionType === "income" ? "(optional)" : "(for expense)"}
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {transactionType === "income" ? "No category (income)" : "Select Category"}
                    </option>
                    {categories
                      .filter((c) => transactionType === "income" ? c.type === "income" : c.type === "expense")
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    transactionType === "expense" ? "Grocery shopping"
                      : transactionType === "income" ? "Paycheck"
                      : "Credit card payment"
                  }
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

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
          {filteredTransactions.length > 0 ? (
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
                    <tr key={tx.id} className={`border-b border-gray-50 last:border-0 ${tx.reconciled ? "bg-blue-50" : ""}`}>
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
                      <td className="py-3 font-medium text-gray-800">
                        {tx.description}
                        {tx.transfer_id && (
                          <span className="ml-2 text-xs text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">↔️</span>
                        )}
                      </td>
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
