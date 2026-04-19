"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Account } from "@/types";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    if (!supabaseRef.current) return;
    const { data } = await supabaseRef.current.from("accounts").select("*").order("name");
    if (data) setAccounts(data);
  }

  function toggleAccount(id: string) {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function selectAllAccounts() {
    setSelectedAccounts(accounts.map((a) => a.id));
  }

  function clearAccounts() {
    setSelectedAccounts([]);
  }

  async function generateReport() {
    if (!supabaseRef.current) return;
    setLoading(true);
    setReportData(null);

    let query = supabaseRef.current
      .from("transactions")
      .select("*, categories(name), accounts(name)");

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);
    if (selectedAccounts.length > 0) query = query.in("account_id", selectedAccounts);

    const { data: transactions } = await query;

    if (transactions) {
      const incomeByCategory: Record<string, number> = {};
      const expenseByCategory: Record<string, number> = {};
      const incomeByAccount: Record<string, number> = {};
      const expenseByAccount: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      transactions.forEach((tx: any) => {
        const catName = tx.categories?.name || "Uncategorized";
        const accName = tx.accounts?.name || "Unknown";
        if (Number(tx.amount) > 0) {
          totalIncome += Number(tx.amount);
          incomeByCategory[catName] = (incomeByCategory[catName] || 0) + Number(tx.amount);
          incomeByAccount[accName] = (incomeByAccount[accName] || 0) + Number(tx.amount);
        } else {
          totalExpenses += Math.abs(Number(tx.amount));
          expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Math.abs(Number(tx.amount));
          expenseByAccount[accName] = (expenseByAccount[accName] || 0) + Math.abs(Number(tx.amount));
        }
      });

      setReportData({
        transactions,
        totalIncome,
        totalExpenses,
        net: totalIncome - totalExpenses,
        incomeByCategory,
        expenseByCategory,
        incomeByAccount,
        expenseByAccount,
        accountCount: selectedAccounts.length > 0 ? selectedAccounts.length : accounts.length,
      });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Accounts ({selectedAccounts.length > 0 ? `${selectedAccounts.length} selected` : "All"})
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={selectAllAccounts}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Select All
              </button>
              <button
                onClick={clearAccounts}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {accounts.map((acc) => (
                <label
                  key={acc.id}
                  className={`text-xs px-2 py-1 rounded cursor-pointer ${
                    selectedAccounts.includes(acc.id) || selectedAccounts.length === 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts.includes(acc.id)}
                    onChange={() => toggleAccount(acc.id)}
                    className="mr-1"
                  />
                  {acc.name}
                </label>
              ))}
            </div>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-1">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                ${reportData.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                ${reportData.totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <p className="text-sm text-gray-500 mb-1">Net</p>
              <p className={`text-2xl font-bold ${reportData.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${reportData.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* By Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">💰 Income by Account</h3>
              </div>
              <div className="p-6">
                {Object.keys(reportData.incomeByAccount).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(reportData.incomeByAccount).map(([acc, amount]) => (
                      <div key={acc} className="flex items-center justify-between">
                        <span className="text-gray-700">{acc}</span>
                        <span className="font-semibold text-green-600">
                          ${(amount as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-gray-400">No income.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">💸 Expenses by Account</h3>
              </div>
              <div className="p-6">
                {Object.keys(reportData.expenseByAccount).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(reportData.expenseByAccount).map(([acc, amount]) => (
                      <div key={acc} className="flex items-center justify-between">
                        <span className="text-gray-700">{acc}</span>
                        <span className="font-semibold text-red-600">
                          ${(amount as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-gray-400">No expenses.</p>
                )}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">📈 Income by Category</h3>
              </div>
              <div className="p-6">
                {Object.keys(reportData.incomeByCategory).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(reportData.incomeByCategory).map(([cat, amount]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="text-gray-700">{cat}</span>
                        <span className="font-semibold text-green-600">
                          ${(amount as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-gray-400">No income in this period.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">📉 Expenses by Category</h3>
              </div>
              <div className="p-6">
                {Object.keys(reportData.expenseByCategory).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(reportData.expenseByCategory)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([cat, amount]) => {
                        const pct = reportData.totalExpenses > 0 ? ((amount as number) / reportData.totalExpenses) * 100 : 0;
                        return (
                          <div key={cat}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-gray-700">{cat}</span>
                              <span className="font-semibold text-red-600">
                                ${(amount as number).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{pct.toFixed(1)}% of total</p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-center py-6 text-gray-400">No expenses in this period.</p>
                )}
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Transactions ({reportData.transactions.length})</h3>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Description</th>
                    <th className="pb-3 font-medium">Account</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 text-sm text-gray-600">{tx.date}</td>
                      <td className="py-3 font-medium text-gray-800">{tx.description}</td>
                      <td className="py-3 text-sm text-gray-600">{tx.accounts?.name || "-"}</td>
                      <td className="py-3 text-sm text-gray-600">{tx.categories?.name || "-"}</td>
                      <td className={`py-3 font-semibold text-right ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {Number(tx.amount) >= 0 ? "+" : ""}${Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
