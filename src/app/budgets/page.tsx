"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Category, Budget, Transaction, Account, ScheduledTransaction } from "@/types";


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function BudgetsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const now = new Date();
  const currentMonth = now.getMonth();
  const [selectedMonths, setSelectedMonths] = useState<number[]>([currentMonth]);
  const [isDesktop, setIsDesktop] = useState(false);

  // Set responsive initial months on mount
  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 768);
    checkWidth();
    // Set initial month selection based on screen size
    if (window.innerWidth >= 768) {
      // Desktop: last month, current month, next 4 months
      const prev = currentMonth === 0 ? 11 : currentMonth - 1;
      const next = [1, 2, 3, 4].map((offset) => (currentMonth + offset) % 12);
      setSelectedMonths([prev, currentMonth, ...next]);
    } else {
      // Mobile: current month only
      setSelectedMonths([currentMonth]);
    }
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);
  const [editingCell, setEditingCell] = useState<{ categoryId: string; month: string } | null>(null);
  const [editingCardCell, setEditingCardCell] = useState<{ accountId: string; month: string } | null>(null);
  const [cellValue, setCellValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [cardBudgets, setCardBudgets] = useState<{ id: string; account_id: string; month: string; amount: number }[]>([]);
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
    const [catResult, budgetResult, txResult, accResult, schResult, cbResult] = await Promise.all([
      supabaseRef.current.from("categories").select("*").order("name"),
      supabaseRef.current.from("budgets").select("*"),
      supabaseRef.current.from("transactions").select("*"),
      supabaseRef.current.from("accounts").select("*"),
      supabaseRef.current.from("scheduled_transactions").select("*").eq("active", true),
      supabaseRef.current.from("card_budgets").select("*"),
    ]);
    if (catResult.data) setCategories(catResult.data);
    if (budgetResult.data) setBudgets(budgetResult.data);
    if (txResult.data) setTransactions(txResult.data);
    if (accResult.data) setAccounts(accResult.data);
    if (schResult.data) setScheduled(schResult.data);
    if (cbResult.data) setCardBudgets(cbResult.data);
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
    console.log("[DEBUG] startEdit called", { categoryId, month, currentValue });
    setEditingCell({ categoryId, month });
    setCellValue(currentValue >= 0 && currentValue !== null && currentValue !== undefined ? String(currentValue) : "");
  }

  function cancelEdit() {
    setEditingCell(null);
    setCellValue("");
  }

  function startCardEdit(accountId: string, month: string, currentValue: number) {
    setEditingCardCell({ accountId, month });
    setCellValue(currentValue >= 0 && currentValue !== null && currentValue !== undefined ? String(currentValue) : "");
  }

  async function saveCardBudget(accountId: string, monthStr: string) {
    const rawValue = cellValue.trim();
    if (rawValue === "") return;
    const amount = parseFloat(rawValue);
    if (isNaN(amount)) { console.error("Invalid amount:", rawValue); return; }
    const formData = new FormData();
    formData.append("accountId", accountId);
    formData.append("month", monthStr);
    formData.append("amount", String(amount));
    let ok = false;
    let res = null;
    let json: any = null;
    try {
      res = await fetch("/api/accounts/card-budget", { method: "POST", body: formData });
      json = await res.json();
      console.log("Card budget API response:", res.status, json);
      ok = res.ok && !json.error;
    } catch (e) {
      console.error("Card budget fetch failed:", e);
    }
    if (!ok) { console.error("Card budget save failed, ok=false"); return; }
    const existing = cardBudgets.find((b) => b.account_id === accountId && b.month === monthStr);
    if (existing) {
      setCardBudgets((prev) => prev.map((b) => b.id === existing.id ? { ...b, amount } : b));
    } else {
      setCardBudgets((prev) => [...prev, { id: crypto.randomUUID(), account_id: accountId, month: monthStr, amount }]);
    }
    setEditingCardCell(null);
    setCellValue("");
  }

  function getCardBudget(accountId: string, month: string): number | null {
    const b = cardBudgets.find((c) => c.account_id === accountId && c.month === month);
    return b !== undefined ? Number(b.amount) : null;
  }

  function getCardActualPaid(cardId: string, monthKey: string): number {
    return transactions
      .filter((t) => {
        if (!t.transfer_id || t.excluded_from_budget) return false;
        if (t.account_id !== cardId) return false;
        return t.date.startsWith(monthKey);
      })
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  }

  function getBudget(categoryId: string, month: string): number | null {
    const budget = budgets.find((b) => b.category_id === categoryId && b.month === month);
    return budget !== undefined ? Number(budget.amount) : null;
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

  
  function getNextOccurrenceMonth(s: ScheduledTransaction, monthKey: string): string | null {
    // Returns the next occurrence date that falls within the given month (YYYY-MM)
    let d = new Date(s.next_date + "T00:00:00");
    const freq = s.frequency || "monthly";
    const interval = s.interval_count || 1;
    let tries = 0;
    while (tries < 366) {
      const dKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (dKey === monthKey) return s.next_date;
      if (d > new Date(`${monthKey}-31`)) return null;
      // Advance
      if (freq === "daily") d.setDate(d.getDate() + interval);
      else if (freq === "weekly") d.setDate(d.getDate() + 7 * interval);
      else if (freq === "monthly") d.setMonth(d.getMonth() + interval);
      else if (freq === "yearly") d.setFullYear(d.getFullYear() + interval);
      else d.setMonth(d.getMonth() + interval);
      tries++;
    }
    return null;
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
            <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
              Year
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
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
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-32 sm:min-w-48">
                  Category
                </th>
                {displayMonths.map((m) => (
                  <th key={m} className="px-4 py-3 text-sm font-semibold text-gray-700 text-center min-w-20 sm:min-w-28">
                    <div className="flex flex-col items-center gap-1">
                      <span>{MONTHS[m]}</span>
                      {displayMonths.length > 1 && (
                        <button
                          onClick={() => {
                            const sourceKey = getMonthKey(m);
                            const targetKeys = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x));
                            for (const c of allCategories) {
                              const v = getBudget(c.id, sourceKey);
                              if (v !== null && v > 0) copyToMonths(c.id, sourceKey, v, targetKeys);
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
                        <td className="px-2 sm:px-4 py-2 font-bold text-green-700 sticky left-0 bg-green-50 z-10" colSpan={1}>📈 INCOME</td>
                        {displayMonths.map((m) => {
                          const monthKey = getMonthKey(m);
                          const totalBudget = incomeCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                          const totalSpent = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                          return (
                            <td key={m} className="px-2 sm:px-4 py-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">Budget / Actual</div>
                              <div className="font-bold text-green-800">${totalBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                              <div className="text-sm text-green-600">${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                            </td>
                          );
                        })}
                      </tr>
                      {incomeCategories.map((cat) => (
                        <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">{cat.name}</td>
                          {displayMonths.map((m) => {
                            const monthKey = getMonthKey(m);
                            const budget = getBudget(cat.id, monthKey);
                            const spent = getSpent(cat.id, monthKey, cat.type);
                            const isEditing = editingCell?.categoryId === cat.id && editingCell?.month === monthKey;
                            const hasData = budget !== null || spent > 0;
                            return (
                              <td key={m} className="px-2 sm:px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <input type="number" step="0.01" value={cellValue} onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0); if (e.key === "Escape") cancelEdit(); }}
                                      autoFocus className="w-20 sm:w-24 px-1 sm:px-2 py-1 border border-blue-400 rounded text-center text-sm" />
                                    <button onClick={() => saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0)} className="text-green-600 hover:text-green-700 text-xs">✓</button>
                                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5 min-h-10 sm:min-h-12">
                                    <div onClick={() => { console.log("[DEBUG] income cell click", cat.id, monthKey, { budget }); startEdit(cat.id, monthKey, budget ?? 0); }} className="cursor-pointer hover:bg-blue-50 rounded py-0.5">
                                      {budget !== null ? <span className="font-semibold text-gray-700">${(budget || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> : <span className="text-gray-300">+</span>}
                                    </div>
                                    {hasData && <div className={`text-sm ${getVarianceColor(budget ?? 0, spent)}`}>${spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>}
                                    {displayMonths.length > 1 && budget !== null && (
                                      <button onClick={(e) => { e.stopPropagation(); const targets = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x)); copyToMonths(cat.id, monthKey, budget ?? 0, targets); }}
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
                        <td className="px-2 sm:px-4 py-2 font-bold text-red-700 sticky left-0 bg-red-50 z-10" colSpan={1}>📉 EXPENSES</td>
                        {displayMonths.map((m) => {
                          const monthKey = getMonthKey(m);
                          const totalBudget = expenseCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                          const totalSpent = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                          return (
                            <td key={m} className="px-2 sm:px-4 py-2 text-center">
                              <div className="text-xs text-gray-500 mb-1">Budget / Actual</div>
                              <div className="font-bold text-red-800">${totalBudget.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                              <div className="text-sm text-red-600">${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                            </td>
                          );
                        })}
                      </tr>
                      {expenseCategories.map((cat) => (
                        <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 font-medium text-gray-800 sticky left-0 bg-white z-10">{cat.name}</td>
                          {displayMonths.map((m) => {
                            const monthKey = getMonthKey(m);
                            const budget = getBudget(cat.id, monthKey);
                            const spent = getSpent(cat.id, monthKey, cat.type);
                            const isEditing = editingCell?.categoryId === cat.id && editingCell?.month === monthKey;
                            const hasData = budget !== null || spent > 0;
                            return (
                              <td key={m} className="px-2 sm:px-4 py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <input type="number" step="0.01" value={cellValue} onChange={(e) => setCellValue(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0); if (e.key === "Escape") cancelEdit(); }}
                                      autoFocus className="w-20 sm:w-24 px-1 sm:px-2 py-1 border border-blue-400 rounded text-center text-sm" />
                                    <button onClick={() => saveBudget(cat.id, monthKey, parseFloat(cellValue) || 0)} className="text-green-600 hover:text-green-700 text-xs">✓</button>
                                    <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5 min-h-10 sm:min-h-12">
                                    <div onClick={() => { console.log("[DEBUG] expense cell click", cat.id, monthKey, { budget }); startEdit(cat.id, monthKey, budget ?? 0); }} className="cursor-pointer hover:bg-blue-50 rounded py-0.5">
                                      {budget !== null ? <span className="font-semibold text-gray-700">${(budget || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span> : <span className="text-gray-300">+</span>}
                                    </div>
                                    {hasData && <div className={`text-sm ${getVarianceColor(budget ?? 0, spent)}`}>${spent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>}
                                    {displayMonths.length > 1 && budget !== null && (
                                      <button onClick={(e) => { e.stopPropagation(); const targets = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x)); copyToMonths(cat.id, monthKey, budget ?? 0, targets); }}
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
                    <td className="px-2 sm:px-4 py-2 font-bold text-blue-800 sticky left-0 bg-blue-50 z-10" colSpan={displayMonths.length + 1}>📊 NET (INCOME − EXPENSES)</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-2 sm:px-4 py-3 sticky left-0 bg-blue-50 z-10"></td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const totalBudgetIncome = incomeCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const totalBudgetExpenses = expenseCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const totalSpentIncome = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                      const totalSpentExpenses = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                      const netBudget = totalBudgetIncome - totalBudgetExpenses;
                      const netActual = totalSpentIncome - totalSpentExpenses;
                      const netColor = netActual >= 0 ? "text-green-600" : "text-red-600";
                      return (
                        <td key={m} className="px-2 sm:px-4 py-3 text-center">
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
                  </tr>
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

      {/* Credit Card Payments section */}
      {(() => {
        const creditCardAccounts = accounts.filter((a) => a.type === "credit");
        if (creditCardAccounts.length === 0) return null;

        return (
          <div className="bg-purple-50 rounded-xl border border-purple-200 p-6">
            <h3 className="font-bold text-purple-800 mb-1">💳 Credit Card Payments</h3>
            <p className="text-xs text-purple-500 mb-4">Monthly payment plan per card — click to edit budgeted amount</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-purple-50 border-b border-purple-200">
                    <th className="px-4 py-3 text-sm font-semibold text-purple-700 sticky left-0 bg-purple-50 z-10 min-w-32 sm:min-w-48">
                      Card
                    </th>
                    {displayMonths.map((m) => (
                      <th key={m} className="px-4 py-3 text-sm font-semibold text-purple-700 text-center min-w-20 sm:min-w-28">
                        <span>{MONTHS[m]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creditCardAccounts.map((card) => (
                    <tr key={card.id} className="border-b border-purple-100 hover:bg-purple-50">
                      <td className="px-2 sm:px-4 py-3 font-medium text-purple-800 sticky left-0 bg-purple-50 z-10">{card.name}</td>
                      {displayMonths.map((m) => {
                        const monthKey = getMonthKey(m);
                        const budgeted = getCardBudget(card.id, monthKey);
                        const actual = getCardActualPaid(card.id, monthKey);
                        const isEditing = editingCardCell?.accountId === card.id && editingCardCell?.month === monthKey;
                        return (
                          <td key={m} className="px-2 sm:px-4 py-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={cellValue}
                                  onChange={(e) => setCellValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveCardBudget(card.id, monthKey);
                                    if (e.key === "Escape") { setEditingCardCell(null); setCellValue(""); }
                                  }}
                                  autoFocus
                                  className="w-20 sm:w-24 px-1 sm:px-2 py-1 border border-purple-400 rounded text-center text-sm"
                                />
                                <button onClick={() => saveCardBudget(card.id, monthKey)} className="text-purple-600 hover:text-purple-700 text-xs">✓</button>
                                <button onClick={() => { setEditingCardCell(null); setCellValue(""); }} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <div
                                  onClick={() => startCardEdit(card.id, monthKey, budgeted ?? 0)}
                                  className="cursor-pointer hover:bg-purple-100 rounded py-0.5"
                                >
                                  <div className="text-xs text-gray-400">Budget / Actual</div>
                                  <span className="font-semibold text-gray-700">
                                    {budgeted !== null && budgeted !== undefined ? `$${(budgeted ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : <span className="text-gray-300">+</span>}
                                  </span>
                                </div>
                                {actual > 0 && (
                                  <span className="text-sm text-purple-700">${actual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                )}
                                {displayMonths.length > 1 && budgeted !== null && budgeted !== undefined && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!supabaseRef.current) return;
                                      const sourceKey = monthKey;
                                      const targetKeys = displayMonths.filter((x) => x !== m).map((x) => getMonthKey(x));
                                      (async () => {
                                        for (const targetMonth of targetKeys) {
                                          const existing = cardBudgets.find((b) => b.account_id === card.id && b.month === targetMonth);
                                          if (existing) {
                                            await supabaseRef.current.from("card_budgets").update({ amount: budgeted ?? 0 }).eq("id", existing.id);
                                          } else {
                                            await supabaseRef.current.from("card_budgets").insert({ account_id: card.id, month: targetMonth, amount: budgeted ?? 0 });
                                          }
                                        }
                                        const { data } = await supabaseRef.current.from("card_budgets").select("*");
                                        if (data) setCardBudgets(data);
                                      })();
                                    }}
                                    className="text-xs text-purple-400 hover:text-purple-600"
                                    title={`Copy ${card.name} budget to other months`}
                                  >
                                    ↔
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-purple-100 border-t-2 border-purple-300">
                    <td className="px-2 sm:px-4 py-2 text-sm font-bold text-purple-900 sticky left-0 bg-purple-50 z-10">Total</td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const totalBudgeted = creditCardAccounts.reduce((sum, card) => sum + (getCardBudget(card.id, monthKey) ?? 0), 0);
                      const totalActual = creditCardAccounts.reduce((sum, card) => sum + getCardActualPaid(card.id, monthKey), 0);
                      const hasAny = totalBudgeted > 0 || totalActual > 0;
                      return (
                        <td key={m} className="px-2 sm:px-4 py-2 text-center">
                          {hasAny ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-gray-500">Budget / Actual</span>
                              <span className="font-bold text-purple-900">${totalBudgeted.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                              {totalActual > 0 && <span className="text-sm font-semibold text-purple-700">${totalActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Cash Flow section */}
      {(() => {
        const ccAccounts = accounts.filter((a) => a.type === "credit");
        function cardBudgetedForMonth(cardId: string, monthKey: string) {
          const b = cardBudgets.find((c) => c.account_id === cardId && c.month === monthKey);
          return b ? Number(b.amount) : 0;
        }
        function cardActualForMonth(cardId: string, monthKey: string) {
          return transactions
            .filter((t) => { if (!t.transfer_id || t.excluded_from_budget) return false; if (t.account_id !== cardId) return false; return t.date.startsWith(monthKey); })
            .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        }

        return (
          <div className="bg-gray-100 rounded-xl border border-gray-300 p-6">
            <h3 className="font-bold text-gray-800 mb-1">💰 Cash Flow</h3>
            <p className="text-xs text-gray-500 mb-4">Income − Expenses − Credit Card Payments</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="px-4 py-3 text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-10 min-w-32 sm:min-w-48"></th>
                    {displayMonths.map((m) => (
                      <th key={m} className="px-4 py-3 text-sm font-semibold text-gray-700 text-center min-w-20 sm:min-w-28">
                        <span>{MONTHS[m]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Income row */}
                  <tr className="border-b border-gray-200">
                    <td className="px-2 sm:px-4 py-3 text-sm font-medium text-green-700 sticky left-0 bg-gray-100 z-10 min-w-32 sm:min-w-48">Income</td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const incomeBudgeted = incomeCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const incomeActual = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                      const hasAny = incomeBudgeted > 0 || incomeActual > 0;
                      return (
                        <td key={m} className="px-2 sm:px-4 py-3 text-center">
                          {hasAny ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="text-xs text-gray-400">Budget / Actual</div>
                              <span className="font-semibold text-green-600">${incomeBudgeted.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                              {incomeActual > 0 && <span className="text-sm text-green-700">${incomeActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Expenses row */}
                  <tr className="border-b border-gray-200">
                    <td className="px-2 sm:px-4 py-3 text-sm font-medium text-red-700 sticky left-0 bg-gray-100 z-10 min-w-32 sm:min-w-48">Expenses</td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const expenseBudgeted = expenseCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const expenseActual = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                      const hasAny = expenseBudgeted > 0 || expenseActual > 0;
                      return (
                        <td key={m} className="px-2 sm:px-4 py-3 text-center">
                          {hasAny ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="text-xs text-gray-400">Budget / Actual</div>
                              <span className="font-semibold text-red-600">${expenseBudgeted.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                              {expenseActual > 0 && <span className="text-sm text-red-700">${expenseActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Credit Card Payments row */}
                  <tr className="border-b border-gray-200">
                    <td className="px-2 sm:px-4 py-3 text-sm font-medium text-purple-700 sticky left-0 bg-gray-100 z-10 min-w-32 sm:min-w-48">CC Payments</td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const cardBudgeted = ccAccounts.reduce((sum, card) => sum + cardBudgetedForMonth(card.id, monthKey), 0);
                      const cardActual = ccAccounts.reduce((sum, card) => sum + cardActualForMonth(card.id, monthKey), 0);
                      const hasAny = cardBudgeted > 0 || cardActual > 0;
                      return (
                        <td key={m} className="px-2 sm:px-4 py-3 text-center">
                          {hasAny ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="text-xs text-gray-400">Budget / Actual</div>
                              <span className="font-semibold text-purple-600">${cardBudgeted.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                              {cardActual > 0 && <span className="text-sm text-purple-700">${cardActual.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Net row */}
                  <tr className="bg-blue-50 border-t-2 border-blue-300">
                    <td className="px-4 py-3 text-sm font-bold text-blue-900 sticky left-0 bg-blue-50 z-10 min-w-32 sm:min-w-48">
                              Net
                              <span className="block text-xs font-normal text-gray-500">Actual − Budget</span>
                            </td>
                    {displayMonths.map((m) => {
                      const monthKey = getMonthKey(m);
                      const incomeBudgeted = incomeCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const expenseBudgeted = expenseCategories.reduce((sum, cat) => sum + (getBudget(cat.id, monthKey) ?? 0), 0);
                      const cardBudgeted = ccAccounts.reduce((sum, card) => sum + cardBudgetedForMonth(card.id, monthKey), 0);
                      const netBudgeted = incomeBudgeted - expenseBudgeted - cardBudgeted;
                      const incomeActual = incomeCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "income"), 0);
                      const expenseActual = expenseCategories.reduce((sum, cat) => sum + getSpent(cat.id, monthKey, "expense"), 0);
                      const cardActual = ccAccounts.reduce((sum, card) => sum + cardActualForMonth(card.id, monthKey), 0);
                      const netActual = incomeActual - expenseActual - cardActual;
                      return (
                        <td key={m} className="px-2 sm:px-4 py-3 text-center">
                          <div className="flex flex-col gap-0.5">
                            <div className="text-xs text-gray-400">Budget / Actual</div>
                            <span className={`font-bold ${netBudgeted >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {netBudgeted !== 0 ? `$${Math.abs(netBudgeted).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                            </span>
                            {netActual !== 0 && (
                              <span className={`text-sm font-semibold ${netActual >= 0 ? "text-green-700" : "text-red-700"}`}>
                                ${Math.abs(netActual).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-gray-400 text-center">
        💡 Click any cell to edit. Use ↔ to copy a value to all selected months. Years and months are filtered above.
      </p>
    </div>
  );
}
