"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Category, Budget, Transaction } from "@/types";


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BudgetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const now = new Date();
  const currentMonth = now.getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const nextSix = [lastMonth];
  for (let i = 1; i <= 6; i++) {
    nextSix.push((lastMonth + i) % 12);
  }
  const [selectedMonths, setSelectedMonths] = useState<number[]>(nextSix);
  const [editingCell, setEditingCell] = useState<{ categoryId: string; month: string } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    const [catResult, budgetResult, txResult] = await Promise.all([
      supabaseRef.current.from("categories").select("*").order("name"),
      supabaseRef.current.from("budgets").select("*"),
      supabaseRef.current.from("transactions").select("*"),
    ]);
    if (catResult.data) setCategories(catResult.data);
    if (budgetResult.data) setBudgets(budgetResult.data);
    if (txResult.data) setTransactions(txResult.data);
  }

  async function saveBudget(categoryId: string, month: string, amount: number) {
    if (!supabaseRef.current) return;
    const existing = budgets.find((b) => b.category_id === categoryId && b.month === month);

    if (existing) {
      await supabaseRef.current.from("budgets").update({ amount }).eq("id", existing.id);
      setBudgets((prev) => prev.map((b) => b.id === existing.id ? { ...b, amount } : b));
    } else {
      const { data } = await supabaseRef.current.from("budgets").insert({ category_id: categoryId, amount, month }).select().single();
      if (data) setBudgets((prev) => [...prev, data]);
    }
    setEditingCell(null);
  }

  async function copyToMonths(categoryId: string, fromMonth: string, amount: number, targetMonths: string[]) {
    if (!supabaseRef.current || saving) return;
    setSaving(true);
    const upsertPromises = targetMonths.map(async (monthStr) => {
      const existing = budgets.find((b) => b.category_id === categoryId && b.month === monthStr);
      if (existing) {
        await supabaseRef.current.from("budgets").update({ amount }).eq("id", existing.id);
      } else {
        await supabaseRef.current.from("budgets").insert({ category_id: categoryId, amount, month: monthStr });
      }
    });
    await Promise.all(upsertPromises);
    // Refresh budgets
    const { data } = await supabaseRef.current.from("budgets").select("*");
    if (data) setBudgets(data);
    setSaving(false);
  }

  function startEdit(categoryId: string, month: string, currentValue: number) {
    setEditingCell({ categoryId, month });
    setCellValue(currentValue > 0 ? String(currentValue) : "");
  }

  function cancelEdit() {
    setEditingCell(null);
    setCellValue("");
  }

  function getBudget(categoryId: string, month: string): number {
    const budget = budgets.find((b) => b.category_id === categoryId && b.month === month);
    return budget ? Number(budget.amount) : 0;
  }

  function getSpent(categoryId: string, monthKey: string, categoryType: string): number {
    return transactions
      .filter((tx) => {
        const isInMonth = tx.date.startsWith(monthKey);
        const matchesCategory = tx.category_id === categoryId;
        if (categoryType === "expense") {
          return isInMonth && matchesCategory && Number(tx.amount) < 0;
        } else {
          return isInMonth && matchesCategory && Number(tx.amount) > 0;
        }
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  }

  function getVarianceColor(budget: number, spent: number): string {
    if (budget === 0 || spent === 0) return "text-gray-400";
    const pct = spent / budget;
    if (pct > 1) return "text-red-600";
    if (pct >= 0.8) return "text-yellow-600";
    return "text-green-600";
  }

  
  function getMonthKey(monthIndex: number): string {
    return `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  function toggleMonth(m: number) {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)
    );
  }

  function selectAllMonths() {
    setSelectedMonths([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  }

  function clearMonths() {
    setSelectedMonths([]);
  }

  const allCategories = categories.filter((c) => c.type === "expense" || c.type === "income");
  const incomeCategories = allCategories.filter((c) => c.type === "income");
  const expenseCategories = allCategories.filter((c) => c.type === "expense");
  const displayMonths = selectedMonths.length > 0 ? selectedMonths : [new Date().getMonth()];

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📊 Budget Planner</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-2 mb-1">
              <button onClick={selectAllMonths} className="text-xs text-blue-600 hover:text-blue-700">All</button>
              <button onClick={clearMonths} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
            </div>
            <div className="flex flex-wrap gap-1 max-w-lg">
              {MONTHS.map((m, i) => (
                <button
                  key={i}
                  onClick={() => toggleMonth(i)}
                  className={`text-xs px-2 py-1 rounded transition ${
                    displayMonths.includes(i) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-48">
                  Category
                </th>
                {displayMonths.map((m) => (
                  <th key={m} className="px-4 py-3 text-sm font-semibold text-gray-700 text-center min-w-28">
                    <div className="flex flex-col items-center gap-1">
                      <span>{MONTHS[m]}</span>
                      {displayMonths.length > 1 && (
                        <button
                          onClick={() => {
                            const sourceKey = getMonthKey(m);
                            const targetKeys = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x));
                            for (const c of allCategories) {
                              const v = getBudget(c.id, sourceKey);
                              if (v > 0) copyToMonths(c.id, sourceKey, v, targetKeys);
                            }
                          }}
                          className="text-xs text-blue-400 hover:text-blue-600"
                          title="Copy all values from this column to other selected months"
                        >
                          ↔
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCategories.length > 0 ? (
                <>
                  {incomeCategories.length > 0 && (
                    <>
                      <tr className="bg-green-50 border-b-2 border-green-200">
                        <td className="px-4 py-2 font-bold text-green-700 sticky left-0 bg-green-50 z-10" colSpan={1}>📈 INCOME</td>
                        {displayMonths.map((m) => {
                          const monthKey = getMonthKey(m);
                          const totalBudget = incomeCategories.reduce((sum, cat) => sum + getBudget(cat.id, monthKey), 0);
                          const totalSpent = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                          return (
                            <td key={m} className="px-4 py-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">Budget / Actual</div>
                              <div className="font-bold text-green-800">${totalBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                              <div className="text-sm text-green-600">${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                            </td>
                          );
                        })}
                      </tr>
                      {incomeCategories.map((cat) => (
                        <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">{cat.name}</td>
                          {displayMonths.map((m) => {
                            const monthKey = getMonthKey(m);
                            const budget = getBudget(cat.id, monthKey);
                            const spent = getSpent(cat.id, monthKey, cat.type);
                            const isEditing = editingCell?.categoryId === cat.id && editingCell?.month === monthKey;
                            const hasData = budget > 0 || spent > 0;
                            return (
                              <td key={m} className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <input type="number" step="0.01" value={cellValue} onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0); if (e.key === "Escape") cancelEdit(); }}
                                      autoFocus className="w-24 px-2 py-1 border border-blue-400 rounded text-center text-sm" />
                                    <button onClick={() => saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0)} className="text-green-600 hover:text-green-700 text-xs">✓</button>
                                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5 min-h-12">
                                    <div onClick={() => startEdit(cat.id, monthKey, budget)} className="cursor-pointer hover:bg-blue-50 rounded py-0.5">
                                      {budget > 0 ? <span className="font-semibold text-gray-700">${budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> : <span className="text-gray-300">+</span>}
                                    </div>
                                    {hasData && <div className={`text-sm ${getVarianceColor(budget, spent)}`}>${spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>}
                                    {displayMonths.length > 1 && budget > 0 && (
                                      <button onClick={(e) => { e.stopPropagation(); const targets = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x)); copyToMonths(cat.id, monthKey, budget, targets); }}
                                        className="text-xs text-blue-400 hover:text-blue-600" title="Copy to other months">↔</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                  {expenseCategories.length > 0 && (
                    <>
                      <tr className="bg-red-50 border-b-2 border-red-200">
                        <td className="px-4 py-2 font-bold text-red-700 sticky left-0 bg-red-50 z-10" colSpan={1}>📉 EXPENSES</td>
                        {displayMonths.map((m) => {
                          const monthKey = getMonthKey(m);
                          const totalBudget = expenseCategories.reduce((sum, cat) => sum + getBudget(cat.id, monthKey), 0);
                          const totalSpent = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                          return (
                            <td key={m} className="px-4 py-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">Budget / Actual</div>
                              <div className="font-bold text-red-800">${totalBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                              <div className="text-sm text-red-600">${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                            </td>
                          );
                        })}
                      </tr>
                      {expenseCategories.map((cat) => (
                        <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">{cat.name}</td>
                          {displayMonths.map((m) => {
                            const monthKey = getMonthKey(m);
                            const budget = getBudget(cat.id, monthKey);
                            const spent = getSpent(cat.id, monthKey, cat.type);
                            const isEditing = editingCell?.categoryId === cat.id && editingCell?.month === monthKey;
                            const hasData = budget > 0 || spent > 0;
                            return (
                              <td key={m} className="px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <input type="number" step="0.01" value={cellValue} onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0); if (e.key === "Escape") cancelEdit(); }}
                                      autoFocus className="w-24 px-2 py-1 border border-blue-400 rounded text-center text-sm" />
                                    <button onClick={() => saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0)} className="text-green-600 hover:text-green-700 text-xs">✓</button>
                                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5 min-h-12">
                                    <div onClick={() => startEdit(cat.id, monthKey, budget)} className="cursor-pointer hover:bg-blue-50 rounded py-0.5">
                                      {budget > 0 ? <span className="font-semibold text-gray-700">${budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> : <span className="text-gray-300">+</span>}
                                    </div>
                                    {hasData && <div className={`text-sm ${getVarianceColor(budget, spent)}`}>${spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>}
                                    {displayMonths.length > 1 && budget > 0 && (
                                      <button onClick={(e) => { e.stopPropagation(); const targets = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x)); copyToMonths(cat.id, monthKey, budget, targets); }}
                                        className="text-xs text-blue-400 hover:text-blue-600" title="Copy to other months">↔</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  )}
                  {/* Net section header */}
                  <tr className="bg-blue-50 border-t-2 border-blue-300">
                    <td className="px-4 py-2 font-bold text-blue-800 sticky left-0 bg-blue-50 z-10" colSpan={displayMonths.length + 1}>📊 NET (INCOME − EXPENSES)</td>
                  </tr>
                  {displayMonths.map((m) => {
                    const monthKey = getMonthKey(m);
                    const totalBudgetIncome = incomeCategories.reduce((sum, cat) => sum + getBudget(cat.id, monthKey), 0);
                    const totalBudgetExpenses = expenseCategories.reduce((sum, cat) => sum + getBudget(cat.id, monthKey), 0);
                    const totalSpentIncome = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                    const totalSpentExpenses = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                    const netBudget = totalBudgetIncome - totalBudgetExpenses;
                    const netActual = totalSpentIncome - totalSpentExpenses;
                    const netColor = netActual >= 0 ? "text-green-600" : "text-red-600";
                    return (
                      <td key={m} className="px-4 py-3 text-center">
                        <div className="flex flex-col gap-0.5">
                          <div className="text-xs text-gray-500">Budgeted</div>
                          <span className="font-semibold text-gray-700">
                            {netBudget !== 0 ? `$${netBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                          </span>
                          <div className="text-xs text-gray-500">Actual</div>
                          <span className={`text-sm font-bold ${netColor}`}>
                            ${netActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </>
              ) : (
                <tr>
                  <td colSpan={displayMonths.length + 1} className="px-4 py-12 text-center text-gray-400">
                    No expense categories yet. <a href="/categories" className="text-blue-600 hover:text-blue-700">Add some →</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        💡 Click any cell to edit. Use ↔ to copy a value to all selected months. Years and months are filtered above.
      </p>
    </div>
  );
}
