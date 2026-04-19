"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReportsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function generateReport() {
    setLoading(true);
    let query = supabase
      .from("transactions")
      .select("*, categories(name), accounts(name)");

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);

    const { data: transactions } = await query;

    if (transactions) {
      const incomeByCategory: Record<string, number> = {};
      const expenseByCategory: Record<string, number> = {};
      let totalIncome = 0;
      let totalExpenses = 0;

      transactions.forEach((tx: any) => {
        const catName = tx.categories?.name || "Uncategorized";
        if (Number(tx.amount) > 0) {
          totalIncome += Number(tx.amount);
          incomeByCategory[catName] = (incomeByCategory[catName] || 0) + Number(tx.amount);
        } else {
          totalExpenses += Math.abs(Number(tx.amount));
          expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Math.abs(Number(tx.amount));
        }
      });

      setReportData({
        transactions,
        totalIncome,
        totalExpenses,
        netSavings: totalIncome - totalExpenses,
        incomeByCategory,
        expenseByCategory,
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
              <p className="text-sm text-gray-500 mb-1">Net Savings</p>
              <p className={`text-2xl font-bold ${reportData.netSavings >= 0 ? "text-green-600" : "text-red-600"}`}>
                ${reportData.netSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income by Category */}
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

            {/* Expense by Category */}
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
                      <td className="py-3 text-sm text-gray-600">{new Date(tx.date).toLocaleDateString()}</td>
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
