"use client";

import { useEffect, useState } from "react";
import { useDrafter, DrafterTemplate } from "@/contexts/DrafterContext";
import { FileDropzone } from "@/components/ui/file-dropzone";

// 今日の日付をYYYYMMDD.md形式で取得
function getDefaultTemplateName(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}.md`;
}

export function TemplateTab() {
  const {
    setActiveTab,
    drafterId,
    templates,
    selectedTemplate,
    currentTemplateContent,
    setCurrentTemplateContent,
    loadTemplates,
    addTemplate,
    selectTemplate,
    updateTemplate,
    deleteTemplate,
  } = useDrafter();

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState(getDefaultTemplateName());
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 初回ロード
  useEffect(() => {
    loadTemplates();
  }, [drafterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // メッセージ自動クリア
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ファイルからテンプレートを読み込む
  const handleFileUpload = async (files: File[], forNewTemplate: boolean = false) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/drafter/parse-file", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: result.error || "ファイルの読み込みに失敗しました" });
        return;
      }

      if (forNewTemplate) {
        setNewTemplateContent(result.content);
        // ファイル名から拡張子を除いた名前をデフォルト名に
        const name = file.name.replace(/\.[^/.]+$/, "");
        if (!newTemplateName) {
          setNewTemplateName(name);
        }
      } else {
        setCurrentTemplateContent(result.content);
      }

      setMessage({ type: "success", text: `「${file.name}」を読み込みました` });
    } catch {
      setMessage({ type: "error", text: "ファイルの読み込み中にエラーが発生しました" });
    } finally {
      setIsUploading(false);
    }
  };

  // 新規テンプレート保存
  const handleAddTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) {
      setMessage({ type: "error", text: "テンプレート名と内容を入力してください" });
      return;
    }

    setIsSaving(true);
    try {
      await addTemplate(newTemplateName.trim(), newTemplateContent.trim());
      setMessage({ type: "success", text: "テンプレートを登録しました" });
      setIsAddingNew(false);
      setNewTemplateName(getDefaultTemplateName());
      setNewTemplateContent("");
    } catch {
      setMessage({ type: "error", text: "テンプレートの登録に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  // テンプレート更新
  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    try {
      await updateTemplate(selectedTemplate.id, currentTemplateContent);
      setMessage({ type: "success", text: "テンプレートを保存しました" });
    } catch {
      setMessage({ type: "error", text: "テンプレートの保存に失敗しました" });
    } finally {
      setIsSaving(false);
    }
  };

  // テンプレート削除
  const handleDeleteTemplate = async (template: DrafterTemplate) => {
    if (!confirm(`「${template.name}」を削除しますか？`)) return;

    try {
      await deleteTemplate(template.id);
      setMessage({ type: "success", text: "テンプレートを削除しました" });
    } catch {
      setMessage({ type: "error", text: "テンプレートの削除に失敗しました" });
    }
  };

  // 内容が変更されたか
  const hasChanges = selectedTemplate && currentTemplateContent !== selectedTemplate.content;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-3xl">
          📋
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">テンプレート管理</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            議事録のフォーマットを登録・編集できます
          </p>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_2fr] gap-6">
        {/* 左側: テンプレート一覧 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">登録済みテンプレート</h3>
              <button
                onClick={() => setIsAddingNew(true)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + 新規
              </button>
            </div>

            {templates.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
                テンプレートがありません
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id
                        ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500"
                        : "bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border-2 border-transparent"
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white text-sm">
                          {template.name}
                        </span>
                        {template.isDefault && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-500 text-white rounded">
                            デフォルト
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="削除"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {template.content.slice(0, 50)}...
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右側: テンプレート編集エリア */}
        <div>
          {isAddingNew ? (
            /* 新規テンプレート追加 */
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">新規テンプレート</h3>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setNewTemplateName(getDefaultTemplateName());
                    setNewTemplateContent("");
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  キャンセル
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  テンプレート名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="例: 定例会議用テンプレート"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ファイルから読み込み
                </label>
                <FileDropzone
                  accept=".pdf,.docx,.md,.txt,.json"
                  onFilesSelected={(files) => handleFileUpload(files, true)}
                  uploading={isUploading}
                  label="ファイルをここにドラッグ&ドロップ"
                  helperText="PDF, DOCX, MD, TXT, JSON対応"
                  compact
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  テンプレート内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  placeholder="テンプレートの内容を入力またはファイルから読み込み..."
                  rows={12}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              <button
                onClick={handleAddTemplate}
                disabled={isSaving || !newTemplateName.trim() || !newTemplateContent.trim()}
                className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {isSaving ? "登録中..." : "テンプレートを登録"}
              </button>
            </div>
          ) : selectedTemplate ? (
            /* テンプレート編集 */
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {selectedTemplate.name}
                  {hasChanges && <span className="ml-2 text-amber-500 text-sm">*未保存</span>}
                </h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ファイルから読み込み
                </label>
                <FileDropzone
                  accept=".pdf,.docx,.md,.txt,.json"
                  onFilesSelected={(files) => handleFileUpload(files, false)}
                  uploading={isUploading}
                  label="ファイルをここにドラッグ&ドロップ"
                  helperText="PDF, DOCX, MD, TXT, JSON対応"
                  compact
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  テンプレート内容
                </label>
                <textarea
                  value={currentTemplateContent}
                  onChange={(e) => setCurrentTemplateContent(e.target.value)}
                  rows={15}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              <button
                onClick={handleUpdateTemplate}
                disabled={isSaving || !hasChanges}
                className="w-full px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {isSaving ? "保存中..." : "変更を保存"}
              </button>
            </div>
          ) : (
            /* 未選択時 */
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
              <div className="text-4xl mb-4">📋</div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                左側からテンプレートを選択するか、<br />
                「+新規」ボタンで新しいテンプレートを登録してください
              </p>
              <button
                onClick={() => setIsAddingNew(true)}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                新規テンプレートを登録
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ナビゲーション */}
      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("intro")}
          className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ← はじめに
        </button>
        <button
          onClick={() => setActiveTab("input")}
          className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          入力情報へ →
        </button>
      </div>
    </div>
  );
}
