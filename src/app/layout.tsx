import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeBank Web",
  description: "Personal finance management web app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="bg-blue-600 text-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">🏦 HomeBank Web</h1>
              <nav className="flex gap-4 items-center">
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
                  </div>
                </div>
              </nav>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">
            {children}
          </main>

          {/* Footer */}
          <footer className="text-center text-gray-500 text-sm py-4">
            HomeBank Web — Personal Finance Made Simple
          </footer>
        </div>
      </body>
    </html>
  );
}
