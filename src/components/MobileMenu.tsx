"use client";

import { useState } from "react";
import SignOutButton from "@/components/SignOutButton";

export default function MobileMenu({ session }: { session: any }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        className="md:hidden p-2 rounded hover:bg-blue-500 transition"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile menu drawer */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-blue-600 shadow-lg z-50">
          <nav className="flex flex-col p-4 gap-1">
            {session && (
              <>
                <span className="text-blue-200 text-sm mb-2 px-2">Hello, {session.user.name}</span>
                <a href="/transactions" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>Transactions</a>
                <a href="/budgets" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>Budgets</a>
                <a href="/reports" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>Reports</a>
                <a href="/scheduled" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>Scheduled</a>
                <div className="border-t border-blue-400 my-2" />
                <a href="/accounts" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>🏦 Accounts</a>
                <a href="/categories" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>🏷️ Categories</a>
                <a href="/import" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>📥 Import</a>
                <a href="/export" className="hover:bg-blue-500 px-4 py-2 rounded transition" onClick={() => setOpen(false)}>📤 Export</a>
                <div className="border-t border-blue-400 my-2" />
                <div className="px-4 py-2"><SignOutButton /></div>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}