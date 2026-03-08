import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  // Allow login and home for everyone
  if (pathname === "/login" || pathname === "/") {
    if (isLoggedIn) {
      const role = (session.user as { role?: string }).role;
      if (role === "REVIEWER") return NextResponse.redirect(new URL("/queue", req.url));
      if (role === "PATIENT") return NextResponse.redirect(new URL("/intake", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: require auth
  if (pathname.startsWith("/intake") || pathname.startsWith("/queue")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const role = (session!.user as { role?: string }).role;
    if (pathname.startsWith("/intake") && role !== "PATIENT") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    if (pathname.startsWith("/queue") && role !== "REVIEWER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
