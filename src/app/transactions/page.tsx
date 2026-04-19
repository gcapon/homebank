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
  const [editingTransferPair, setEditingTransferPair] = useState<{ fromTx: Transaction; toTx: Transaction } | null>(null);
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
    memo: "",
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
      supabaseRef.current.from("transactions").select("id, account_id, category_id, description, amount, date, reconciled, transfer_id, memo, created_at, accounts(name), categories(name)").order("date", { ascending: false }),
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
      if (editingTransferPair) {
        // Editing existing transfer pair
        const absAmount = Math.abs(formData.amount);
        const fromTx = editingTransferPair.fromTx;
        const toTx = editingTransferPair.toTx;

        // Old amounts and accounts (signs already correct in DB)
        const oldFromAmount = Number(fromTx.amount);
        const oldToAmount = Number(toTx.amount);
        const oldFromAccountId = fromTx.account_id;
        const oldToAccountId = toTx.account_id;
        const newFromAccountId = formData.account_id;
        const newToAccountId = formData.to_account_id;

        // New amounts (from is always negative outflow, to is positive inflow)
        const newFromAmount = -absAmount;
        const newToAmount = absAmount;

        // Determine what changed
        const fromAccountChanged = oldFromAccountId !== newFromAccountId;
        const toAccountChanged = oldToAccountId !== newToAccountId;

        // Update transaction records with new account_ids, amounts, descriptions, dates
        await supabaseRef.current.from("transactions").update({
          account_id: newFromAccountId,
          description: `${formData.description} → ${accounts.find((a) => a.id === newToAccountId)?.name || ""}`,
          amount: newFromAmount,
          date: formData.date,
          memo: formData.memo,
        }).eq("id", fromTx.id);

        await supabaseRef.current.from("transactions").update({
          account_id: newToAccountId,
          description: `${formData.description} ← ${accounts.find((a) => a.id === newFromAccountId)?.name || ""}`,
          amount: newToAmount,
          date: formData.date,
          memo: formData.memo,
        }).eq("id", toTx.id);

        // Update account balances:
        // 1. Reverse old from from the old from account (if from changed, this reverses the old; otherwise it adjusts the same account)
        // 2. Apply new from to the new from account
        // Same pattern for to account

        if (fromAccountChanged) {
          // Restore old from account: add back the old amount (+oldFromAmount because oldFromAmount is negative)
          const oldFromAcct = accounts.find((a) => a.id === oldFromAccountId);
          if (oldFromAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(oldFromAcct.balance) - oldFromAmount,
            }).eq("id", oldFromAccountId);
          }
          // Apply new from to new from account
          const newFromAcct = accounts.find((a) => a.id === newFromAccountId);
          if (newFromAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(newFromAcct.balance) + newFromAmount,
            }).eq("id", newFromAccountId);
          }
        } else {
          // Same from account: adjust by the difference
          const fromAcct = accounts.find((a) => a.id === oldFromAccountId);
          if (fromAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(fromAcct.balance) - oldFromAmount + newFromAmount,
            }).eq("id", oldFromAccountId);
          }
        }

        if (toAccountChanged) {
          // Reverse old to from old to account
          const oldToAcct = accounts.find((a) => a.id === oldToAccountId);
          if (oldToAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(oldToAcct.balance) - oldToAmount,
            }).eq("id", oldToAccountId);
          }
          // Apply new to to new to account
          const newToAcct = accounts.find((a) => a.id === newToAccountId);
          if (newToAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(newToAcct.balance) + newToAmount,
            }).eq("id", newToAccountId);
          }
        } else {
          // Same to account: adjust by the difference
          const toAcct = accounts.find((a) => a.id === oldToAccountId);
          if (toAcct) {
            await supabaseRef.current.from("accounts").update({
              balance: Number(toAcct.balance) - oldToAmount + newToAmount,
            }).eq("id", oldToAccountId);
          }
        }

        setEditingTransferPair(null);
      } else {
        // Creating new transfer
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
        if (!res.ok) {
          const err = await res.json();
          alert("Error: " + err.error);
          return;
        }
      }
      setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, memo: "", date: defaultDate });
      setShowForm(false);
      setTransactionType("expense");
      fetchData();
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
        memo: formData.memo,
      }).eq("id", editingId);

      const oldAccount = accounts.find((a) => a.id === oldTx?.account_id);
      const newAccount = accounts.find((a) => a.id === formData.account_id);

      if (oldAccount) {
        await supabaseRef.current.from("accounts").update({ balance: Number(oldAccount.balance) - oldAmount }).eq("id", oldAccount.id);
      }
      if (newAccount) {
        await supabaseRef.current.from("accounts").update({ balance: Number(newAccount.balance) + amount }).eq("id", newAccount.id);
      }
      setEditingId(null);
    } else {
      await supabaseRef.current.from("transactions").insert({
        account_id: formData.account_id,
        category_id: formData.category_id || null,
        description: formData.description,
        amount,
        date: formData.date,
        memo: formData.memo,
      });

      const account = accounts.find((a) => a.id === formData.account_id);
      if (account) {
        await supabaseRef.current.from("accounts").update({ balance: Number(account.balance) + amount }).eq("id", account.id);
      }
    }

    setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, memo: "", date: defaultDate });
    setShowForm(false);
    fetchData();
  }

  function startEdit(tx: Transaction) {
    const pair = tx.transfer_id
      ? transactions.find((t) => t.id !== tx.id && t.transfer_id === tx.transfer_id)
      : null;

    if (pair) {
      setEditingTransferPair({ fromTx: tx, toTx: pair });
      setTransactionType("transfer");
      const isFrom = Number(tx.amount) < 0;
      const fromTx = isFrom ? tx : pair;
      const toTx = isFrom ? pair : tx;
      setFormData({
        account_id: fromTx.account_id,
        to_account_id: toTx.account_id,
        category_id: "",
        description: fromTx.description.replace(/\s*[\u2192\u2190]\s.*/, ""), // strip arrow suffix
        amount: Math.abs(Number(fromTx.amount)),
        memo: (fromTx as any).memo || "",
        date: fromTx.date,
      });
    } else {
      setEditingId(tx.id);
      setTransactionType(Number(tx.amount) < 0 ? "expense" : "income");
      setFormData({
        account_id: tx.account_id,
        to_account_id: "",
        category_id: tx.category_id || "",
        description: tx.description,
        amount: Math.abs(Number(tx.amount)),
        memo: tx.memo || "",
        date: tx.date,
      });
    }
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTransferPair(null);
    setFormData({ account_id: "", to_account_id: "", category_id: "", description: "", amount: 0, memo: "", date: defaultDate });
    setShowForm(false);
    setTransactionType("expense");
  }

  async function handleDelete(id: string) {
    if (!supabaseRef.current) return;
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    if (tx.transfer_id) {
      if (!confirm("⚠️ This is a transfer. Deleting it will remove BOTH sides of the transfer. Continue?")) return;
      const pair = transactions.find((t) => t.id !== id && t.transfer_id === tx.transfer_id);
      // Reverse balances for both
      const fromAcct = accounts.find((a) => a.id === tx.account_id);
      if (fromAcct) {
        await supabaseRef.current.from("accounts").update({ balance: Number(fromAcct.balance) - Number(tx.amount) }).eq("id", tx.account_id);
      }
      await supabaseRef.current.from("transactions").delete().eq("id", tx.id);
      if (pair) {
        const toAcct = accounts.find((a) => a.id === pair.account_id);
        if (toAcct) {
          await supabaseRef.current.from("accounts").update({ balance: Number(toAcct.balance) - Number(pair.amount) }).eq("id", pair.account_id);
        }
        await supabaseRef.current.from("transactions").delete().eq("id", pair.id);
      }
    } else {
      if (!confirm("Delete this transaction?")) return;
      const account = accounts.find((a) => a.id === tx.account_id);
      if (account) {
        await supabaseRef.current.from("accounts").update({ balance: Number(account.balance) - Number(tx.amount) }).eq("id", account.id);
      }
      await supabaseRef.current.from("transactions").delete().eq("id", id);
    }
    fetchData();
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

  // Compute running balance: sort ASCENDING to accumulate from oldest to newest
  const selectedAccount = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) : null;
  const runningBalanceMap = (() => {
    if (!selectedAccountId || !selectedAccount) return new Map<string, number>();
    const sorted = [...filteredTransactions].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      if (dc !== 0) return dc;
      return ((a as any).created_at || a.id).localeCompare((b as any).created_at || b.id);
    });
    let r = Number(selectedAccount.opening_balance || 0);
    const m = new Map<string, number>();
    for (const tx of sorted) { r += Number(tx.amount); m.set(tx.id, r); }
    return m;
  })();

  // Sort display DESCENDING (newest first) while runningBalanceMap uses ascending for correct accumulation
  const displayTransactions = [...filteredTransactions].sort((a, b) => {
    // Primary: newest date first
    const dc = b.date.localeCompare(a.date);
    if (dc !== 0) return dc;
    // Tiebreaker: within same day, newest created_at first (reverse of ascending sort)
    const ca = (a as any).created_at || a.id;
    const cb = (b as any).created_at || b.id;
    return cb.localeCompare(ca);
  });

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
            setEditingTransferPair(null);
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
            {editingTransferPair && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                📋 You're editing both sides of this transfer. Changes apply to both the From and To accounts.
              </div>
            )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Memo / Notes (optional)</label>
                <input
                  type="text"
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Extra notes..."
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
                {editingTransferPair ? "Update Transfer" : editingId ? "Update Transaction" : "Add Transaction"}
              </button>
              {(editingId || editingTransferPair) && (
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
          {displayTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium w-10"></th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Memo</th>
                    <th className="pb-3 font-medium">Account</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                    {selectedAccountId && <th className="pb-3 font-medium text-right">Balance</th>}
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTransactions.map((tx) => (
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
                      <td className="py-3 text-sm text-gray-500">{tx.memo || "-"}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).accounts?.name || "-"}</td>
                      <td className="py-3 text-sm text-gray-600">{(tx as any).categories?.name || "-"}</td>
                      <td className={`py-3 font-semibold text-right ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      {selectedAccountId && (
                        <td className={`py-3 text-right font-medium ${(runningBalanceMap.get(tx.id) || 0) >= 0 ? "text-gray-700" : "text-red-600"}`}>
                          ${(runningBalanceMap.get(tx.id) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td className="py-3 text-right">
                        <button onClick={() => startEdit(tx)} className="text-blue-400 hover:text-blue-600 text-xs mr-3">Edit</button>
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
