"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className="hover:text-blue-200 transition flex items-center gap-1 cursor-pointer text-sm"
    >
      Sign Out
    </button>
  );
}