"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";

export default function ExportPage() {
  const [loading, setLoading] = useState<string | null>(null);

  async function downloadJSON() {
    setLoading("json");
    try {
      const res = await fetch("/api/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `homebank-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  async function downloadCSV(table: "transactions" | "accounts" | "categories") {
    setLoading(table);
    try {
      const res = await fetch("/api/export");
      const data = await res.json();
      const rows = data[table];
      if (!rows || rows.length === 0) {
        alert(`No ${table} to export.`);
        return;
      }
      const headers = Object.keys(rows[0]);
      const csvRows = [
        headers.join(","),
        ...rows.map((row: any) =>
          headers.map((h) => {
            const val = row[h] ?? "";
            const str = String(val);
            // Escape quotes and wrap if contains comma/quote/newline
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(",")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `homebank-${table}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800">📤 Export Data</h2>
      <p className="text-gray-500 text-sm">
        Download a full backup or export specific tables as CSV.
      </p>

      {/* Full JSON Backup */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-1">Full Backup (JSON)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Complete export of all accounts, categories, transactions, scheduled transactions, and budgets.
        </p>
        <button
          onClick={downloadJSON}
          disabled={loading === "json"}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading === "json" ? "Preparing..." : "Download Full Backup"}
        </button>
      </div>

      {/* CSV Exports */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold text-gray-800 mb-1">Export as CSV</h3>
        <p className="text-sm text-gray-500 mb-4">Download individual tables as CSV files for use in spreadsheet apps.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadCSV("transactions")}
            disabled={loading === "transactions"}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-left"
          >
            <div className="font-medium text-gray-700">Transactions</div>
            <div className="text-xs text-gray-400">All posted transactions</div>
          </button>
          <button
            onClick={() => downloadCSV("accounts")}
            disabled={loading === "accounts"}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-left"
          >
            <div className="font-medium text-gray-700">Accounts</div>
            <div className="text-xs text-gray-400">All accounts</div>
          </button>
          <button
            onClick={() => downloadCSV("categories")}
            disabled={loading === "categories"}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 text-left"
          >
            <div className="font-medium text-gray-700">Categories</div>
            <div className="text-xs text-gray-400">All categories</div>
          </button>
        </div>
      </div>
    </div>
  );
}
