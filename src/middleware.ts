import { type NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    "/((?!api|payments-api|_next/static|_next/image|assets|favicon.ico|sw.js).*)",
  ],
};

export async function middleware(req: NextRequest) {
  if (
    req.nextUrl.pathname.indexOf("icon") > -1 ||
    req.nextUrl.pathname.indexOf("chrome") > -1
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}
