"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { DrafterConfig } from "@foundry/core/types";
import { HomeButton } from "@/components/ui/home-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DrafterListPage() {
  const t = useTranslations("drafter");
  const [drafters, setDrafters] = useState<DrafterConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tools");
        if (res.ok) {
          const data = await res.json();
          setDrafters(data.drafters || []);
        }
      } catch (err) {
        console.error("Failed to fetch drafters:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-6">
              <HomeButton />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-2xl">
                  📝
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t("title")}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("subtitle")}</p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Description */}
        <section className="mb-8">
          <p className="text-slate-600 dark:text-slate-400 max-w-3xl">
            ドラフター型は、議事録、決裁書、提案書など、定型文書をAIで自動生成するアプリケーションです。
            テンプレートに基づいて、効率的に高品質な文書を作成できます。
          </p>
        </section>

        {/* Drafter Grid */}
        <section>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : drafters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafters.map((drafter) => (
                <Link key={drafter.id} href={`/drafter/${drafter.id}`} className="group">
                  <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-green-100 dark:border-green-900/50 p-6 h-full hover:shadow-lg hover:border-green-300 dark:hover:border-green-700 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-2xl">
                        📝
                      </div>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded">
                        {t("badge")}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      {drafter.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                      {drafter.description}
                    </p>
                    <div className="mt-4 flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                      <span>開く</span>
                      <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                ドラフターがまだありません
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {t("noAppsDesc")}
              </p>
              <Link
                href="/meta-finder"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {t("goToMetaFinder")}
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
