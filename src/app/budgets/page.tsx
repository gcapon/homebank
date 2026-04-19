"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Budget, Category } from "@/types";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ category_id: "", amount: 0, month: "" });
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
    const [budgetResult, catResult] = await Promise.all([
      supabaseRef.current.from("budgets").select("*, categories(name)").order("month", { ascending: false }),
      supabaseRef.current.from("categories").select("*").order("name"),
    ]);
    if (budgetResult.data) setBudgets(budgetResult.data);
    if (catResult.data) setCategories(catResult.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;
    const now = new Date();
    const month = formData.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await supabaseRef.current.from("budgets").insert({ category_id: formData.category_id, amount: formData.amount, month });
    setFormData({ category_id: "", amount: 0, month: "" });
    setShowForm(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!supabaseRef.current) return;
    if (confirm("Delete this budget?")) {
      await supabaseRef.current.from("budgets").delete().eq("id", id);
      fetchData();
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Budgets</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? "Cancel" : "+ Set Budget"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="500.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <input
                  type="month"
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              Create Budget
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6">
          {budgets.length > 0 ? (
            <div className="space-y-4">
              {budgets.map((budget) => (
                <div key={budget.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100 relative">
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
                  >
                    ✕
                  </button>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-800">{(budget as any).categories?.name || "Unknown"}</span>
                    <span className="text-sm text-gray-500">{budget.month}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-600">
                      ${Number(budget.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-gray-500">monthly budget</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📊</p>
              <p>No budgets set yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
