import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import MobileMenu from "@/components/MobileMenu";

export const metadata: Metadata = {
  title: "HomeBank Web",
  description: "Personal finance management web app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions).catch(() => null);

  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="bg-blue-600 text-white shadow-md">
              <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                {/* Left: logo + name */}
                <div className="flex items-center gap-3 shrink-0">
                  <h1 className="text-xl font-bold"><a href="/">🏦 HomeBank Web</a></h1>
                  {session?.user?.name && (
                    <span className="text-sm text-blue-200 hidden sm:inline">Hello, {session.user.name}</span>
                  )}
                </div>

                {/* Center/Right: desktop nav — hidden on mobile */}
                <nav className="hidden md:flex items-center gap-4">
                  <a href="/transactions" className="hover:text-blue-200 transition">Transactions</a>
                  <a href="/budgets" className="hover:text-blue-200 transition">Budgets</a>
                  <a href="/reports" className="hover:text-blue-200 transition">Reports</a>
                  <a href="/scheduled" className="hover:text-blue-200 transition">Scheduled</a>
                  {/* Settings dropdown */}
                  <div className="relative group">
                    <button className="hover:text-blue-200 transition flex items-center gap-1 cursor-pointer">
                      ⚙️ Settings ▾
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white text-gray-700 rounded-lg shadow-lg border border-gray-100 overflow-hidden w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
                      <a href="/accounts" className="block px-4 py-2 hover:bg-blue-50 transition">🏦 Accounts</a>
                      <a href="/categories" className="block px-4 py-2 hover:bg-blue-50 transition">🏷️ Categories</a>
                      <a href="/import" className="block px-4 py-2 hover:bg-blue-50 transition">📥 Import</a>
                      <a href="/export" className="block px-4 py-2 hover:bg-blue-50 transition">📤 Export</a>
                    </div>
                  </div>
                  <SignOutButton />
                </nav>

                {/* Right: mobile hamburger */}
                {session && <MobileMenu session={session} />}
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
              {children}
            </main>

            {/* Footer */}
            {session && (
              <footer className="text-center text-gray-500 text-sm py-4">
                HomeBank Web — Personal Finance Made Simple
              </footer>
            )}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}