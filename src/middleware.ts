import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ユーザーアクセス制限: ALLOWED_USERS が設定されている場合のみ適用
  const allowedUsers = process.env.ALLOWED_USERS;
  if (allowedUsers) {
    const principalName = request.headers.get("x-ms-client-principal-name") || "";
    const currentUser = principalName.toLowerCase();

    // 未認証ユーザーはAzure AD loginにリダイレクト
    if (!currentUser) {
      const loginUrl = new URL("/.auth/login/aad", request.url);
      loginUrl.searchParams.set("post_login_redirect_uri", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 認証済みだがリストにないユーザーは403
    const allowedList = allowedUsers.split(",").map(u => u.trim().toLowerCase());
    if (!allowedList.some(allowed => currentUser === allowed || currentUser.startsWith(allowed + "@"))) {
      return new NextResponse("アクセス権限がありません (403 Forbidden)\nUser: " + principalName, { status: 403 });
    }
  }

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
  matcher: "/((?!api|trpc|_next|_vercel|\\.auth|.*\\..*).*)",
};
