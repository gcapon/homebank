"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function HomePage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("id, account_id, category_id, description, amount, date, reconciled, transfer_id, memo, created_at, accounts(name), categories(name)").order("date", { ascending: false }).limit(5),
    ]).then(([accRes, txRes]) => {
      if (accRes.data) setAccounts(accRes.data);
      if (txRes.data) setTransactions(txRes.data);
    });
  }, []);

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance) + Number(acc.opening_balance), 0) || 0;
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <a
          href="/transactions"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          + Add Transaction
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Balance</p>
          <p className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{accounts.length} accounts</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Income</p>
          <p className="text-2xl font-bold text-green-600">
            ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">
            ${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <a href="/accounts" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2">
          <span className="text-2xl">🏦</span>
          <span className="text-sm font-medium text-gray-700">Add Account</span>
        </a>
        <a href="/categories" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2">
          <span className="text-2xl">🏷️</span>
          <span className="text-sm font-medium text-gray-700">Add Category</span>
        </a>
        <a href="/budgets" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2">
          <span className="text-2xl">📊</span>
          <span className="text-sm font-medium text-gray-700">Set Budget</span>
        </a>
        <a href="/reports" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2">
          <span className="text-2xl">📈</span>
          <span className="text-sm font-medium text-gray-700">View Reports</span>
        </a>
        <button
          onClick={async () => {
            const res = await fetch("/api/export");
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `homebank-backup-${new Date().toISOString().split("T")[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="text-2xl">📄</span>
          <span className="text-sm font-medium text-gray-700">Export JSON</span>
        </button>
        <button
          onClick={async () => {
            const res = await fetch("/api/export");
            const data = await res.json();
            // Convert transactions to CSV
            const headers = ["id", "date", "description", "amount", "account", "category", "reconciled", "transfer_id"];
            const rows = data.transactions.map((tx: any) => [
              tx.id,
              tx.date,
              `"${(tx.description || "").replace(/"/g, '""')}"`,
              tx.amount,
              `"${(tx.account_id || "").replace(/"/g, '""')}"`,
              `"${(tx.category_id || "").replace(/"/g, '""')}"`,
              tx.reconciled,
              tx.transfer_id || "",
            ].join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `homebank-transactions-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:border-blue-300 transition flex flex-col items-center gap-2 cursor-pointer"
        >
          <span className="text-2xl">📊</span>
          <span className="text-sm font-medium text-gray-700">Export CSV</span>
        </button>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Recent Transactions</h3>
          <a href="/transactions" className="text-sm text-blue-600 hover:text-blue-700">View All →</a>
        </div>
        <div className="p-6">
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {tx.categories?.name || "Uncategorized"} • {tx.accounts?.name || "Unknown Account"} • {tx.date}
                    </p>
                  </div>
                  <p className={`font-semibold ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {Number(tx.amount) >= 0 ? "+" : ""}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">💸</p>
              <p>No transactions yet. Add your first one!</p>
              <a href="/transactions" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">+ Add Transaction</a>
            </div>
          )}
        </div>
      </div>

      {/* Accounts Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Accounts</h3>
          <a href="/accounts" className="text-sm text-blue-600 hover:text-blue-700">Manage →</a>
        </div>
        <div className="p-6">
          {accounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">
                      {acc.type === "checking" ? "🏦" : acc.type === "savings" ? "🐷" : acc.type === "credit" ? "💳" : "💵"}
                    </span>
                    <span className="text-xs text-gray-500 uppercase">{acc.type}</span>
                  </div>
                  <p className="font-semibold text-gray-800">{acc.name}</p>
                  <p className={`text-lg font-bold ${Number(acc.balance) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    ${Number(acc.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">🏦</p>
              <p>No accounts yet.</p>
              <a href="/accounts" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">+ Add Account</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
