"use client";

import { useState } from "react";
import { useDrafter } from "@/contexts/DrafterContext";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export function EditTab() {
  const { setActiveTab, currentDraft, setCurrentDraft, drafterId } = useDrafter();
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // 議事録ドラフターかどうか
  const isMeetingMinutes = drafterId === "minutes";

  const handleExportWord = async () => {
    if (!currentDraft) return;
    setIsExporting(true);

    try {
      // コンテンツを段落に分割
      const paragraphs = currentDraft.content.split("\n").map((line) => {
        return new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: "Yu Gothic",
              size: 24, // 12pt
            }),
          ],
        });
      });

      // タイトルを先頭に追加
      const titleParagraph = new Paragraph({
        children: [
          new TextRun({
            text: currentDraft.title,
            font: "Yu Gothic",
            size: 32, // 16pt
            bold: true,
          }),
        ],
      });

      const doc = new Document({
        sections: [
          {
            children: [titleParagraph, new Paragraph({ text: "" }), ...paragraphs],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${currentDraft.title || "document"}.docx`);

      // ステータスを更新
      setCurrentDraft({
        ...currentDraft,
        status: "final",
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Export failed:", error);
      alert("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportText = () => {
    if (!currentDraft) return;

    const content = `${currentDraft.title}\n\n${currentDraft.content}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${currentDraft.title || "document"}.txt`);
  };

  const handleExportMarkdown = () => {
    if (!currentDraft) return;

    const content = `# ${currentDraft.title}\n\n${currentDraft.content}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${currentDraft.title || "document"}.md`);
  };

  const handleCopyToClipboard = async () => {
    if (!currentDraft) return;

    try {
      const content = `${currentDraft.title}\n\n${currentDraft.content}`;
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      alert("コピーに失敗しました");
    }
  };

  if (!currentDraft) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">下書きがありません</p>
          <button
            onClick={() => setActiveTab(isMeetingMinutes ? "input" : "generate")}
            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {isMeetingMinutes ? "入力情報へ戻る" : "下書きを生成する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">プレビュー・保存</h2>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded ${
              currentDraft.status === "draft"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200"
                : currentDraft.status === "review"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                : "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
            }`}>
              {currentDraft.status === "draft" ? "下書き" : currentDraft.status === "review" ? "レビュー中" : "完成"}
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {/* プレビュー */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                生成された議事録
              </label>
              <button
                onClick={handleCopyToClipboard}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  copied
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                {copied ? "コピーしました" : "クリップボードにコピー"}
              </button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">
                {currentDraft.title}
              </h3>
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed">
                {currentDraft.content || "（内容なし）"}
              </div>
            </div>
          </div>

          {/* エクスポートオプション */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              ファイルに保存
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Wordファイルで保存後、Microsoft Copilotで編集できます
            </p>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={handleExportWord}
                disabled={isExporting}
                className="p-4 border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-center disabled:opacity-50"
              >
                <div className="text-2xl mb-2">📘</div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {isExporting ? "保存中..." : "Word"}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400">.docx</p>
              </button>
              <button
                onClick={handleExportText}
                className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📄</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">テキスト</p>
                <p className="text-xs text-slate-500">.txt</p>
              </button>
              <button
                onClick={handleExportMarkdown}
                className="p-4 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-center"
              >
                <div className="text-2xl mb-2">📝</div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Markdown</p>
                <p className="text-xs text-slate-500">.md</p>
              </button>
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab(isMeetingMinutes ? "input" : "generate")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {isMeetingMinutes ? "← 入力情報" : "← 再生成"}
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
