"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Category, Budget } from "@/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BudgetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [editingCell, setEditingCell] = useState<{ categoryId: string; month: string } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [saving, setSaving] = useState(false);
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
    const [catResult, budgetResult] = await Promise.all([
      supabaseRef.current.from("categories").select("*").order("name"),
      supabaseRef.current.from("budgets").select("*"),
    ]);
    if (catResult.data) setCategories(catResult.data);
    if (budgetResult.data) setBudgets(budgetResult.data);
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

  const expenseCategories = categories.filter((c) => c.type === "expense");
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
                            for (const c of expenseCategories) {
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
              {expenseCategories.length > 0 ? (
                expenseCategories.map((cat) => (
                  <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">
                      {cat.name}
                    </td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const budget = getBudget(cat.id, monthKey);
                      const isEditing = editingCell?.categoryId === cat.id && editingCell?.month === monthKey;

                      return (
                        <td key={m} className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={cellValue}
                                onChange={(e) => setCellValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                autoFocus
                                className="w-24 px-2 py-1 border border-blue-400 rounded text-center text-sm"
                              />
                              <button
                                onClick={() => saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0)}
                                className="text-green-600 hover:text-green-700 text-xs"
                              >
                                ✓
                              </button>
                              <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                            </div>
                          ) : (
                            <div
                              onClick={() => startEdit(cat.id, monthKey, budget)}
                              className="cursor-pointer hover:bg-blue-50 rounded py-1"
                            >
                              {budget > 0 ? (
                                <div>
                                  <span className="font-semibold text-gray-700">${budget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                  {displayMonths.length > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const targets = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x));
                                        copyToMonths(cat.id, monthKey, budget, targets);
                                      }}
                                      className="ml-1 text-xs text-blue-400 hover:text-blue-600"
                                      title="Copy to other months"
                                    >
                                      ↔
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-lg">+</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
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
