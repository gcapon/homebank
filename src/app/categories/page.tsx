"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", type: "expense" as "income" | "expense", parent_id: "" });
  const supabase = createClient();

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("*").order("name");
    if (data) setCategories(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("categories").insert({ ...formData, parent_id: formData.parent_id || null });
    setFormData({ name: "", type: "expense", parent_id: "" });
    setShowForm(false);
    fetchCategories();
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this category?")) {
      await supabase.from("categories").delete().eq("id", id);
      fetchCategories();
    }
  }

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Categories</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? "Cancel" : "+ Add Category"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Food & Dining"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "income" | "expense" })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category (optional)</label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
              Create Category
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-green-600">📈</span> Income Categories
            </h3>
          </div>
          <div className="p-6">
            {incomeCategories.length > 0 ? (
              <div className="space-y-2">
                {incomeCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-800">{cat.name}</span>
                    <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500 transition">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-gray-400">No income categories yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-red-600">📉</span> Expense Categories
            </h3>
          </div>
          <div className="p-6">
            {expenseCategories.length > 0 ? (
              <div className="space-y-2">
                {expenseCategories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-800">{cat.name}</span>
                    <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500 transition">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-gray-400">No expense categories yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
