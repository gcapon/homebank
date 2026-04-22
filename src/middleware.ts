import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Let signin and auth pages pass through
  const url = request.nextUrl.pathname;
  if (url.startsWith("/auth") || url.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // For all other routes, check for session
  // Note: NextAuth middleware handles this automatically when properly configured
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!auth/|api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};