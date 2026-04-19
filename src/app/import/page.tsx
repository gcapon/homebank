'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Papa from 'papaparse';
import type { Account } from '@/types';

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({ accountId: '', dateCol: '', descCol: '', amountCol: '', typeCol: '', memoCol: '' });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported?: number; error?: string } | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);

  useEffect(() => {
    supabaseRef.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    if (!supabaseRef.current) return;
    const { data } = await supabaseRef.current.from('accounts').select('*').order('name');
    if (data) setAccounts(data);
  }

  function handleFileSelect(f: File) {
    setFile(f);
    setResult(null);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const cols = results.meta.fields || [];
        setHeaders(cols);
        setPreview(results.data as Record<string, string>[]);
        // Auto-detect common column names
        const dateMatch = cols.find((c) => /date/i.test(c));
        const descMatch = cols.find((c) => /description|memo|payee/i.test(c));
        const amountMatch = cols.find((c) => /amount|value|sum/i.test(c));
        const typeMatch = cols.find((c) => /type|transfer|income|expense/i.test(c));
        const memoMatch = cols.find((c) => /note|memo|comment|reference/i.test(c));
        setMapping({
          accountId: mapping.accountId,
          dateCol: dateMatch || cols[0] || '',
          descCol: descMatch || cols[1] || '',
          amountCol: amountMatch || cols[2] || '',
          typeCol: typeMatch || '',
          memoCol: memoMatch || '',
        });
      },
    });
  }

  async function handleImport() {
    if (!file || !mapping.accountId || !mapping.dateCol || !mapping.descCol || !mapping.amountCol) return;
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', mapping.accountId);
    formData.append('dateCol', mapping.dateCol);
    formData.append('descCol', mapping.descCol);
    formData.append('amountCol', mapping.amountCol);
    formData.append('typeCol', mapping.typeCol);
    formData.append('memoCol', mapping.memoCol);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.message });
    }
    setImporting(false);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">📥 Import Transactions from CSV</h2>

      {/* Account Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Import into Account</label>
        <select
          value={mapping.accountId}
          onChange={(e) => setMapping({ ...mapping, accountId: e.target.value })}
          className="w-full md:w-64 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select Account</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>{acc.name}</option>
          ))}
        </select>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select CSV File</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="w-full md:w-auto"
        />
        {file && (
          <p className="text-sm text-gray-500 mt-2">Selected: {file.name} ({preview.length} rows)</p>
        )}
      </div>

      {/* Column Mapping */}
      {headers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Map CSV Columns</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date Column</label>
              <select
                value={mapping.dateCol}
                onChange={(e) => setMapping({ ...mapping, dateCol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description Column</label>
              <select
                value={mapping.descCol}
                onChange={(e) => setMapping({ ...mapping, descCol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount Column</label>
              <select
                value={mapping.amountCol}
                onChange={(e) => setMapping({ ...mapping, amountCol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type Column (transfer/income/expense)</label>
              <select
                value={mapping.typeCol}
                onChange={(e) => setMapping({ ...mapping, typeCol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">None</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Memo/Notes Column (optional)</label>
              <select
                value={mapping.memoCol}
                onChange={(e) => setMapping({ ...mapping, memoCol: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">None</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Preview (first 5 rows)</h3>
          </div>
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  {headers.map((h) => <th key={h} className="pb-2 pr-4">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {headers.map((h) => <td key={h} className="py-2 pr-4">{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && mapping.accountId && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleImport}
            disabled={importing}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {importing ? 'Importing...' : `Import ${preview.length} Transactions`}
          </button>
          {result && 'imported' in result && (
            <span className="text-green-600 font-medium">✓ Imported {result.imported} transactions!</span>
          )}
          {result && 'error' in result && (
            <span className="text-red-600 font-medium">✕ {result.error}</span>
          )}
        </div>
      )}
    </div>
  );
}
