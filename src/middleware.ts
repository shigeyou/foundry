import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // レポート専用モード: /meta-finder/report 以外はすべてリダイレクト
  if (process.env.REPORT_ONLY_MODE === "true") {
    // 許可パス: /meta-finder/report（locale prefix付きも含む）
    const isReportPage =
      pathname === "/meta-finder/report" ||
      /^\/[a-z]{2}\/meta-finder\/report$/.test(pathname);

    if (!isReportPage) {
      return NextResponse.redirect(new URL("/meta-finder/report", request.url));
    }
  }

  // 俺ナビ（/me）は環境変数 ENABLE_ORE_NAVI=true の場合のみ許可
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
