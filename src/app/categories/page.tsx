"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Category, CategoryType } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; type: CategoryType; parent_id: string }>({ name: "", type: "expense", parent_id: "" });
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    fetchCategories();
  }, []);

  async function fetchCategories() {
    if (!supabaseRef.current) return;
    const { data } = await supabaseRef.current.from("categories").select("*").order("name");
    if (data) setCategories(data);
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setFormData({ name: cat.name, type: cat.type, parent_id: cat.parent_id || "" });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseRef.current) return;
    if (editingId) {
      await supabaseRef.current.from("categories").update({ name: formData.name, type: formData.type, parent_id: formData.parent_id || null }).eq("id", editingId);
      setEditingId(null);
    } else {
      await supabaseRef.current.from("categories").insert({ ...formData, parent_id: formData.parent_id || null });
    }
    setFormData({ name: "", type: "expense", parent_id: "" });
    setShowForm(false);
    fetchCategories();
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData({ name: "", type: "expense", parent_id: "" });
    setShowForm(false);
  }

  async function handleDelete(id: string) {
    if (!supabaseRef.current) return;
    if (confirm("Delete this category?")) {
      await supabaseRef.current.from("categories").delete().eq("id", id);
      fetchCategories();
    }
  }

  const incomeCategories = categories.filter((c) => c.type === "income" || c.type === "both");
  const expenseCategories = categories.filter((c) => c.type === "expense" || c.type === "both");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Categories</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ name: "", type: "expense", parent_id: "" });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          {showForm ? "Cancel" : "+ Add Category"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {editingId && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                ✏️ Editing category
              </div>
            )}
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
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as CategoryType })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="both">Both</option>
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
                  {categories
                    .filter((c) => c.id !== editingId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                {editingId ? "Update Category" : "Create Category"}
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
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(cat)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500 transition">✕</button>
                    </div>
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
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(cat)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                      <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500 transition">✕</button>
                    </div>
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