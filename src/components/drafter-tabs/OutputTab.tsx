"use client";

import { useDrafter } from "@/contexts/DrafterContext";

export function OutputTab() {
  const { setActiveTab, currentDraft, setCurrentDraft } = useDrafter();

  const handleFinalize = () => {
    if (currentDraft) {
      setCurrentDraft({
        ...currentDraft,
        status: "final",
        updatedAt: new Date(),
      });
    }
  };

  const handleExport = (format: "text" | "markdown" | "word") => {
    if (!currentDraft) return;

    let content = currentDraft.content;
    let filename = `${currentDraft.title || "document"}`;
    let mimeType = "text/plain";

    switch (format) {
      case "markdown":
        filename += ".md";
        mimeType = "text/markdown";
        break;
      case "word":
        // 簡易的なRTF形式で出力
        filename += ".rtf";
        mimeType = "application/rtf";
        content = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 MS Gothic;}}
\\f0\\fs24 ${content.replace(/\n/g, "\\par ")}
}`;
        break;
      default:
        filename += ".txt";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!currentDraft) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">出力する下書きがありません</p>
          <button
            onClick={() => setActiveTab("generate")}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            下書きを生成する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">出力</h2>

        <div className="space-y-6">
          {/* プレビュー */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">プレビュー</h3>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{currentDraft.title}</h4>
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {currentDraft.content || "（内容なし）"}
              </div>
            </div>
          </div>

          {/* ステータス */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">ステータス</p>
                <p className={`font-medium ${
                  currentDraft.status === "final"
                    ? "text-green-600 dark:text-green-400"
                    : "text-yellow-600 dark:text-yellow-400"
                }`}>
                  {currentDraft.status === "final" ? "完成" : "未確定"}
                </p>
              </div>
              {currentDraft.status !== "final" && (
                <button
                  onClick={handleFinalize}
                  className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  完成にする
                </button>
              )}
            </div>
          </div>

          {/* エクスポートオプション */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">エクスポート</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleExport("text")}
                className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📄</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">テキスト</p>
                <p className="text-xs text-slate-500">.txt</p>
              </button>
              <button
                onClick={() => handleExport("markdown")}
                className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📝</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Markdown</p>
                <p className="text-xs text-slate-500">.md</p>
              </button>
              <button
                onClick={() => handleExport("word")}
                className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📑</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Word互換</p>
                <p className="text-xs text-slate-500">.rtf</p>
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("edit")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              ← 編集に戻る
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className="px-4 py-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
            >
              履歴を見る →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
