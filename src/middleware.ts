import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // 俺ナビ（/me）は環境変数 ENABLE_ORE_NAVI=true の場合のみ許可
  const pathname = request.nextUrl.pathname;
  if (pathname === "/me" || pathname.match(/^\/[a-z]{2}\/me$/)) {
    if (process.env.ENABLE_ORE_NAVI !== "true") {
      return NextResponse.redirect(new URL("/meta-finder", request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
