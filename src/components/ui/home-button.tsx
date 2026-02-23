"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface HomeButtonProps {
  variant?: "default" | "compact" | "text";
  className?: string;
}

// 家+炎アイコン（Foundryロゴ）
function FoundryHomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      {/* 屋根 */}
      <path d="M3 11L12 3L21 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* 壁 */}
      <path d="M5 11V20H19V11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.15)"/>
      {/* 炎（外） */}
      <path d="M12 19C12 19 9 16.2 9 13.8C9 12.25 10.35 11 12 11C13.65 11 15 12.25 15 13.8C15 16.2 12 19 12 19Z" fill="#FF8C42"/>
      {/* 炎（内） */}
      <path d="M12 17.5C12 17.5 10.5 15.8 10.5 14.5C10.5 13.7 11.15 13 12 13C12.85 13 13.5 13.7 13.5 14.5C13.5 15.8 12 17.5 12 17.5Z" fill="#FFD166"/>
    </svg>
  );
}

export function HomeButton({ variant = "default", className }: HomeButtonProps) {
  const tc = useTranslations("common");

  if (variant === "text") {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors group",
          className
        )}
      >
        <span className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center flex-shrink-0">
          <FoundryHomeIcon className="w-3 h-3" />
        </span>
        <span className="text-sm font-medium group-hover:-translate-x-0.5 transition-transform">{tc("back")}</span>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-all group",
          className
        )}
      >
        <span className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center flex-shrink-0">
          <FoundryHomeIcon className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300 group-hover:-translate-x-0.5 transition-transform">{tc("back")}</span>
      </Link>
    );
  }

  // Default variant - most prominent
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 group hover:-translate-y-0.5",
        className
      )}
    >
      <span className="w-7 h-7 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
        <FoundryHomeIcon className="w-4 h-4" />
      </span>
      <span className="text-sm font-bold group-hover:-translate-x-0.5 transition-transform">{tc("back")}</span>
    </Link>
  );
}
