"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

interface Project {
  id: string;
  name: string;
  department?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
  _count: { documents: number; flows: number; reports: number };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "下書き", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  analyzing: { label: "分析中", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "完了", color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" },
};

// 部門タブ固定順序
const DEPARTMENT_ORDER = [
  "全て",
  "全社",
  "総合企画部",
  "人事総務部",
  "経理部",
  "海洋技術事業部",
  "海技訓練事業部",
  "海事業務部",
  "オンサイト事業部",
  "新造船PM事業本部",
];

export default function BottleneckProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("全て");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/bottleneck/project");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // 部門タブ: データから動的に件数を計算、固定順序で表示
  const departmentTabs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      const dept = p.department || "未分類";
      counts[dept] = (counts[dept] || 0) + 1;
    }
    const tabs: { label: string; count: number }[] = [{ label: "全て", count: projects.length }];
    for (const dept of DEPARTMENT_ORDER) {
      if (dept === "全て") continue;
      if (counts[dept]) {
        tabs.push({ label: dept, count: counts[dept] });
        delete counts[dept];
      }
    }
    // 固定順序にない部門を末尾に追加
    for (const [dept, count] of Object.entries(counts)) {
      tabs.push({ label: dept, count });
    }
    return tabs;
  }, [projects]);

  // フィルタリングされたプロジェクト
  const filteredProjects = useMemo(() => {
    if (activeTab === "全て") return projects;
    return projects.filter((p) => (p.department || "未分類") === activeTab);
  }, [projects, activeTab]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/bottleneck/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), department: newDept.trim() || undefined, description: newDesc.trim() || undefined }),
      });
      if (res.ok) {
        setNewName("");
        setNewDept("");
        setNewDesc("");
        setShowCreate(false);
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    try {
      await fetch("/api/bottleneck/project", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchProjects();
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">
                ボトルネックファインダー
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                業務フローを分析し、自動化可能なボトルネックを発見
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/bottleneck/report"
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm"
            >
              横断レポート
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              + 新規プロジェクト
            </button>
          </div>
        </div>

        {/* Department tabs */}
        <div className="bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 rounded-t-xl mb-0">
          <div className="flex overflow-x-auto gap-1 py-2 px-3 scrollbar-thin">
            {departmentTabs.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(tab.label)}
                className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
                  activeTab === tab.label
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {tab.label}
                <span className={`text-xs ${activeTab === tab.label ? "text-orange-100" : "text-slate-400 dark:text-slate-500"}`}>
                  ({tab.count})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-6 mt-4 p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold mb-4">新規プロジェクト</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">プロジェクト名 *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例: 経費精算フロー分析"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">部門</label>
                <input
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  placeholder="例: 経理部"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">説明</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="プロジェクトの概要（任意）"
                  rows={2}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
                >
                  {creating ? "作成中..." : "作成"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔧</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              {activeTab === "全て" ? "プロジェクトがありません" : `${activeTab}のプロジェクトはありません`}
            </p>
            {activeTab === "全て" && (
              <p className="text-sm text-slate-400 dark:text-slate-500">「新規プロジェクト」からプロジェクトを作成してください</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 mt-4">
            {filteredProjects.map((p) => {
              const sc = statusConfig[p.status] || statusConfig.draft;
              return (
                <Link
                  key={p.id}
                  href={`/bottleneck/${p.id}`}
                  className="block p-5 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg hover:border-orange-300 dark:hover:border-orange-600 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate">
                          {p.name}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                      </div>
                      {p.department && <p className="text-sm text-slate-500 dark:text-slate-400">{p.department}</p>}
                      {p.description && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{p.description}</p>}
                      <div className="flex gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>ドキュメント: {p._count.documents}</span>
                        <span>フロー: {p._count.flows}</span>
                        <span>レポート: {p._count.reports}</span>
                        <span>{new Date(p.createdAt).toLocaleDateString("ja-JP")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id); }}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="削除"
                      >
                        <svg className="w-4 h-4 text-slate-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <svg className="w-5 h-5 text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
