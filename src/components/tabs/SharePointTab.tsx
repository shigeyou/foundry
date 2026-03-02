"use client";

import { useState, useCallback } from "react";

// ─── 型定義 ───

interface SPSite {
  id: string;
  displayName: string;
  webUrl: string;
  description?: string;
}

interface SPDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl: string;
}

interface SPFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
}

interface TreeNode {
  site: SPSite;
  drives: SPDrive[];
}

interface Suggestion {
  itemId: string;
  filename: string;
  relevance: "high" | "medium" | "low";
  reason: string;
}

interface ImportResult {
  filename: string;
  action: string;
  error?: string;
}

// ─── ユーティリティ ───

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function fileIcon(file: SPFile): string {
  if (file.folder) return "\uD83D\uDCC1";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    pdf: "\uD83D\uDCC4", docx: "\uD83D\uDCC3", doc: "\uD83D\uDCC3", xlsx: "\uD83D\uDCCA", xls: "\uD83D\uDCCA",
    pptx: "\uD83D\uDCBB", ppt: "\uD83D\uDCBB", txt: "\uD83D\uDCDD", md: "\uD83D\uDCDD", csv: "\uD83D\uDCCA",
    json: "\u2699\uFE0F", png: "\uD83D\uDDBC\uFE0F", jpg: "\uD83D\uDDBC\uFE0F", mp4: "\uD83C\uDFA5",
  };
  return icons[ext] || "\uD83D\uDCC4";
}

const relevanceColors: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400",
};

// ─── Chevron SVG ───
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── メインコンポーネント ───

export function SharePointTab() {
  // 接続・ツリー
  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [totalSites, setTotalSites] = useState(0);
  const [filterText, setFilterText] = useState("");

  // 展開状態
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());
  const [expandedDrives, setExpandedDrives] = useState<Set<string>>(new Set());

  // ドライブ内ファイル（遅延ロード）
  const [driveFiles, setDriveFiles] = useState<Record<string, SPFile[]>>({});
  const [driveNextLinks, setDriveNextLinks] = useState<Record<string, string | null>>({});
  const [driveLoading, setDriveLoading] = useState<Set<string>>(new Set());

  // フォルダ展開
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderFiles, setFolderFiles] = useState<Record<string, SPFile[]>>({});
  const [folderLoading, setFolderLoading] = useState<Set<string>>(new Set());

  // 選択・提案・インポート
  const [selectedFiles, setSelectedFiles] = useState<Map<string, { driveId: string; itemId: string; filename: string }>>(new Map());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // ローディング
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ─── ツリー取得 ───
  const loadTree = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sharepoint/tree");
      if (res.status === 401) {
        setHasToken(false);
        setAuthChecked(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setHasToken(true);
      setTree(data.tree || []);
      setTotalSites(data.totalSites || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ツリー取得に失敗しました");
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }, []);

  // ─── サイト展開/折りたたみ ───
  const toggleSite = (siteId: string) => {
    setExpandedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  // ─── ドライブ展開（ファイル遅延ロード） ───
  const toggleDrive = async (driveId: string) => {
    if (expandedDrives.has(driveId)) {
      setExpandedDrives(prev => { const n = new Set(prev); n.delete(driveId); return n; });
      return;
    }
    setExpandedDrives(prev => new Set(prev).add(driveId));

    if (driveFiles[driveId]) return; // 既にロード済み

    setDriveLoading(prev => new Set(prev).add(driveId));
    try {
      const res = await fetch(`/api/sharepoint/files?driveId=${encodeURIComponent(driveId)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setDriveFiles(prev => ({ ...prev, [driveId]: data.files || [] }));
      setDriveNextLinks(prev => ({ ...prev, [driveId]: data.nextLink || null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ファイル取得に失敗しました");
    } finally {
      setDriveLoading(prev => { const n = new Set(prev); n.delete(driveId); return n; });
    }
  };

  // ─── もっと読み込む ───
  const loadMoreFiles = async (driveId: string) => {
    const nextLink = driveNextLinks[driveId];
    if (!nextLink) return;
    setDriveLoading(prev => new Set(prev).add(driveId));
    try {
      const res = await fetch(`/api/sharepoint/files?driveId=${encodeURIComponent(driveId)}&nextLink=${encodeURIComponent(nextLink)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setDriveFiles(prev => ({ ...prev, [driveId]: [...(prev[driveId] || []), ...(data.files || [])] }));
      setDriveNextLinks(prev => ({ ...prev, [driveId]: data.nextLink || null }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setDriveLoading(prev => { const n = new Set(prev); n.delete(driveId); return n; });
    }
  };

  // ─── フォルダ展開 ───
  const toggleFolder = async (driveId: string, folder: SPFile) => {
    const key = `${driveId}:${folder.id}`;
    if (expandedFolders.has(key)) {
      setExpandedFolders(prev => { const n = new Set(prev); n.delete(key); return n; });
      return;
    }
    setExpandedFolders(prev => new Set(prev).add(key));

    if (folderFiles[key]) return;

    setFolderLoading(prev => new Set(prev).add(key));
    try {
      const res = await fetch(`/api/sharepoint/files?driveId=${encodeURIComponent(driveId)}&itemId=${encodeURIComponent(folder.id)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setFolderFiles(prev => ({ ...prev, [key]: data.files || [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "フォルダ取得に失敗しました");
    } finally {
      setFolderLoading(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  // ─── 全展開/全折りたたみ ───
  const expandAll = () => {
    setExpandedSites(new Set(filteredTree.map(n => n.site.id)));
  };
  const collapseAll = () => {
    setExpandedSites(new Set());
    setExpandedDrives(new Set());
    setExpandedFolders(new Set());
  };

  // ─── ファイル選択 ───
  const toggleFileSelect = (driveId: string, file: SPFile) => {
    setSelectedFiles(prev => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.set(file.id, { driveId, itemId: file.id, filename: file.name });
      return next;
    });
  };

  // ─── AI提案 ───
  const runSuggest = async () => {
    // 全展開済みドライブのファイルを収集
    const allFiles: SPFile[] = [];
    Object.values(driveFiles).forEach(files => allFiles.push(...files));
    Object.values(folderFiles).forEach(files => allFiles.push(...files));

    if (allFiles.length === 0) {
      setError("先にドライブを展開してファイルを読み込んでください");
      return;
    }

    setSuggestLoading(true);
    setError("");
    setSuggestions([]);
    try {
      const res = await fetch("/api/sharepoint/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: allFiles }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setSuggestions(data.suggestions || []);

      if (data.suggestions?.length) {
        // 提案ファイルを自動選択（driveIdを探す）
        const next = new Map<string, { driveId: string; itemId: string; filename: string }>();
        for (const s of data.suggestions as Suggestion[]) {
          if (s.relevance === "high" || s.relevance === "medium") {
            // driveIdを逆引き
            for (const [did, files] of Object.entries(driveFiles)) {
              const f = files.find(f => f.id === s.itemId);
              if (f) { next.set(f.id, { driveId: did, itemId: f.id, filename: f.name }); break; }
            }
            for (const [key, files] of Object.entries(folderFiles)) {
              const did = key.split(":")[0];
              const f = files.find(f => f.id === s.itemId);
              if (f) { next.set(f.id, { driveId: did, itemId: f.id, filename: f.name }); break; }
            }
          }
        }
        setSelectedFiles(next);
        setMessage(`AI提案: ${data.suggestions.length}件のファイルを推薦しました`);
      } else {
        setMessage("提案対象のファイルがありませんでした");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI提案に失敗しました");
    } finally {
      setSuggestLoading(false);
    }
  };

  // ─── インポート ───
  const runImport = async () => {
    if (selectedFiles.size === 0) return;
    setImportLoading(true);
    setError("");
    setImportResults([]);
    setMessage("");
    try {
      // driveIdごとにグループ化
      const byDrive = new Map<string, Array<{ itemId: string; filename: string }>>();
      for (const sel of selectedFiles.values()) {
        const items = byDrive.get(sel.driveId) || [];
        items.push({ itemId: sel.itemId, filename: sel.filename });
        byDrive.set(sel.driveId, items);
      }

      const allResults: ImportResult[] = [];
      let totalImported = 0;
      for (const [driveId, items] of byDrive) {
        const res = await fetch("/api/sharepoint/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driveId, items }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const data = await res.json();
        allResults.push(...(data.results || []));
        totalImported += data.imported || 0;
      }
      setImportResults(allResults);
      setMessage(`${totalImported}件のファイルをRAGにインポートしました`);
      setSelectedFiles(new Map());
    } catch (err) {
      setError(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setImportLoading(false);
    }
  };

  // ─── フィルタ ───
  const filteredTree = filterText
    ? tree.filter(n => n.site.displayName.toLowerCase().includes(filterText.toLowerCase())
        || (n.site.description || "").toLowerCase().includes(filterText.toLowerCase()))
    : tree;

  // ─── ファイル行レンダー ───
  const renderFileRow = (file: SPFile, driveId: string, depth: number) => {
    const suggestion = suggestions.find(s => s.itemId === file.id);
    const isFolder = !!file.folder;
    const folderKey = `${driveId}:${file.id}`;
    const isFolderOpen = expandedFolders.has(folderKey);
    const isFolderLoading = folderLoading.has(folderKey);
    const isSelected = selectedFiles.has(file.id);
    const indent = 16 + depth * 20;

    return (
      <div key={file.id}>
        <div
          className={`flex items-center py-1.5 pr-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-sm ${
            isSelected ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
          }`}
          style={{ paddingLeft: `${indent}px` }}
        >
          {isFolder ? (
            <button
              onClick={() => toggleFolder(driveId, file)}
              className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
            >
              {isFolderLoading ? (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <Chevron open={isFolderOpen} />
              )}
              <span className="flex-shrink-0">{fileIcon(file)}</span>
              <span className="font-medium text-slate-800 dark:text-white truncate">{file.name}</span>
              <span className="text-xs text-slate-400 flex-shrink-0">({file.folder!.childCount})</span>
            </button>
          ) : (
            <label className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleFileSelect(driveId, file)}
                className="rounded border-slate-300 dark:border-slate-600 flex-shrink-0 ml-4"
              />
              <span className="flex-shrink-0">{fileIcon(file)}</span>
              <span className="text-slate-800 dark:text-white truncate">{file.name}</span>
            </label>
          )}
          {!isFolder && (
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              {suggestion && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${relevanceColors[suggestion.relevance]}`}>
                  {suggestion.relevance}
                </span>
              )}
              <span className="text-xs text-slate-400 w-16 text-right">{formatSize(file.size)}</span>
              <span className="text-xs text-slate-400 w-20 text-right">{formatDate(file.lastModifiedDateTime)}</span>
            </div>
          )}
        </div>
        {/* フォルダ子要素 */}
        {isFolder && isFolderOpen && folderFiles[folderKey] && (
          folderFiles[folderKey].map(child => renderFileRow(child, driveId, depth + 1))
        )}
      </div>
    );
  };

  // ─── 初期表示 ───
  if (!authChecked) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">SharePoint連携</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            SharePoint全サイトのドキュメントを階層表示し、RAGナレッジベースにインポートできます。
          </p>
          <button
            onClick={loadTree}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {loading ? "読み込み中..." : "SharePointに接続"}
          </button>
        </div>
      </div>
    );
  }

  // ─── トークンなし ───
  if (!hasToken) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">SharePoint連携</h2>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3">セットアップが必要です</h3>
            <div className="space-y-4 text-sm text-amber-700 dark:text-amber-300">
              <div>
                <p className="font-medium mb-2">アプリ登録（推奨）:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Entra ID でアプリ登録（Sites.Read.All, Files.Read.All）</li>
                  <li>管理者同意を付与</li>
                  <li><code className="bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">.env</code> に SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, SHAREPOINT_CLIENT_SECRET を追加</li>
                  <li>開発サーバーを再起動</li>
                </ol>
              </div>
            </div>
            <button
              onClick={loadTree}
              className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm"
            >
              再接続
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── メイン: 階層ビュー ───
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">SharePoint 階層ビュー</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{totalSites}サイト取得済み（内部サイト除外）</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="サイト名でフィルタ..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm w-56"
            />
            <button
              onClick={loadTree}
              disabled={loading}
              className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm transition-colors"
            >
              {loading ? "..." : "再取得"}
            </button>
            <button onClick={expandAll} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm transition-colors">
              全展開
            </button>
            <button onClick={collapseAll} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm transition-colors">
              全折りたたみ
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex justify-between items-center">
            <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}
        {message && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex justify-between items-center">
            <span className="text-green-700 dark:text-green-300 text-sm">{message}</span>
            <button onClick={() => setMessage("")} className="text-green-500 hover:text-green-700">&times;</button>
          </div>
        )}

        {/* アクションバー */}
        {(selectedFiles.size > 0 || suggestions.length > 0) && (
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 sticky top-16 z-10">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedFiles.size}件選択中
            </span>
            <div className="flex gap-2">
              <button
                onClick={runSuggest}
                disabled={suggestLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                {suggestLoading ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />AI分析中...</>
                ) : "AI提案"}
              </button>
              <button
                onClick={runImport}
                disabled={importLoading || selectedFiles.size === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
              >
                {importLoading ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />インポート中...</>
                ) : `インポート (${selectedFiles.size})`}
              </button>
              {selectedFiles.size > 0 && (
                <button
                  onClick={() => setSelectedFiles(new Map())}
                  className="px-3 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm"
                >
                  選択解除
                </button>
              )}
            </div>
          </div>
        )}

        {/* ローディング */}
        {loading && (
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 py-8 justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>全サイトのフォルダ階層を取得中...</span>
          </div>
        )}

        {/* ツリー */}
        {!loading && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {filteredTree.length === 0 ? (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">
                サイトが見つかりません
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredTree.map(node => {
                  const siteOpen = expandedSites.has(node.site.id);
                  return (
                    <div key={node.site.id}>
                      {/* サイト行 */}
                      <button
                        onClick={() => toggleSite(node.site.id)}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left"
                      >
                        <Chevron open={siteOpen} />
                        <span className="text-lg">&#x1F310;</span>
                        <span className="font-semibold text-slate-800 dark:text-white">{node.site.displayName}</span>
                        {node.site.description && (
                          <span className="text-xs text-slate-400 truncate ml-2 flex-1">{node.site.description}</span>
                        )}
                        <span className="text-xs text-slate-400 flex-shrink-0">{node.drives.length} ライブラリ</span>
                      </button>

                      {/* ドライブ一覧 */}
                      {siteOpen && (
                        <div className="bg-slate-50/50 dark:bg-slate-800/50">
                          {node.drives.map(drive => {
                            const driveOpen = expandedDrives.has(drive.id);
                            const files = driveFiles[drive.id] || [];
                            const isLoading = driveLoading.has(drive.id);
                            const hasMore = driveNextLinks[drive.id];

                            return (
                              <div key={drive.id}>
                                {/* ドライブ行 */}
                                <button
                                  onClick={() => toggleDrive(drive.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors text-left"
                                  style={{ paddingLeft: "36px" }}
                                >
                                  {isLoading && !driveOpen ? (
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                  ) : (
                                    <Chevron open={driveOpen} />
                                  )}
                                  <span className="text-base">{"\uD83D\uDCC2"}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">{drive.name}</span>
                                  <span className="text-xs text-slate-400">({drive.driveType})</span>
                                </button>

                                {/* ファイル一覧 */}
                                {driveOpen && (
                                  <div>
                                    {isLoading && files.length === 0 && (
                                      <div className="flex items-center gap-2 py-2 text-xs text-slate-400" style={{ paddingLeft: "72px" }}>
                                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        読み込み中...
                                      </div>
                                    )}
                                    {files.map(file => renderFileRow(file, drive.id, 0))}
                                    {hasMore && (
                                      <button
                                        onClick={() => loadMoreFiles(drive.id)}
                                        disabled={isLoading}
                                        className="w-full py-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                        style={{ paddingLeft: "72px" }}
                                      >
                                        {isLoading ? "読み込み中..." : "もっと読み込む"}
                                      </button>
                                    )}
                                    {files.length === 0 && !isLoading && (
                                      <p className="py-2 text-xs text-slate-400" style={{ paddingLeft: "72px" }}>空のライブラリ</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {node.drives.length === 0 && (
                            <p className="text-xs text-slate-400 py-2" style={{ paddingLeft: "36px" }}>ライブラリなし</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* インポート結果 */}
        {importResults.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">インポート結果</h3>
            <div className="space-y-2">
              {importResults.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={
                    r.action === "created" ? "text-green-600" :
                    r.action === "updated" ? "text-blue-600" :
                    r.action === "skipped" ? "text-yellow-600" :
                    "text-red-600"
                  }>
                    {r.action === "created" ? "\u2713 作成" :
                     r.action === "updated" ? "\u21BB 更新" :
                     r.action === "skipped" ? "\u2192 スキップ" :
                     "\u2717 エラー"}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">{r.filename}</span>
                  {r.error && <span className="text-red-500 text-xs">({r.error})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
