"use client";

import { useState, useEffect, useRef } from "react";
import { useDrafter, PastMinutesFile, DrafterTemplate } from "@/contexts/DrafterContext";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

// アップロード用 fetch（2分タイムアウト）
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000;

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// ========================================
// 共通コンポーネント
// ========================================

interface InputSectionProps {
  icon: string;
  title: string;
  description: string;
  action: string; // 何をするかのアクション説明
  children: React.ReactNode;
  optional?: boolean;
  defaultCollapsed?: boolean;
  stepNumber?: string; // ③④⑤⑥などの番号
}

function InputSection({ icon, title, description, action, children, optional = true, defaultCollapsed = true, stepNumber }: InputSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // 番号の背景色を決定（必須はブルー系、任意は灰色系）
  const numberBgClass = optional
    ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
    : "bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          {stepNumber ? (
            <span className={`flex items-center justify-center w-6 h-6 ${numberBgClass} rounded-full text-sm font-bold flex-shrink-0`}>
              {stepNumber}
            </span>
          ) : (
            <span className="text-base">{icon}</span>
          )}
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{title}</h3>
              {optional ? (
                <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded leading-none">
                  任意
                </span>
              ) : (
                <span className="text-[10px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-medium leading-none">
                  必須
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{description}</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isCollapsed ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="px-2.5 pb-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ファイル読み込み + テキスト入力
interface FileOrTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}

function FileOrTextInput({ value, onChange, placeholder, rows = 6 }: FileOrTextInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadedFileName(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetchWithTimeout("/api/drafter/parse-file", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "ファイルの読み込みに失敗しました");
        return;
      }

      onChange(result.content);
      setUploadedFileName(file.name);
    } catch (err) {
      console.error("File upload error:", err);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setError(isTimeout ? "タイムアウトしました（2分）。ファイルを小さくして再試行してください。" : "ファイルの読み込み中にエラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <FileDropzone
        accept=".pdf,.docx,.md,.txt,.json,.msg,.eml"
        onFilesSelected={handleFileUpload}
        uploading={isUploading}
        label="ファイルをドラッグ&ドロップ"
        helperText="PDF, DOCX, TXT, MSG, EML 対応"
      />

      {uploadedFileName && !error && (
        <div className="text-xs text-green-600 dark:text-green-400">
          ✓ {uploadedFileName} を読み込みました
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// 会議情報用（AI抽出機能付き）
interface MeetingOverviewInputProps {
  value: string;
  onChange: (value: string) => void;
}

function MeetingOverviewInput({ value, onChange }: MeetingOverviewInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadedFileName(null);
    setStatusMessage("ファイルを読み込み中...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const parseResponse = await fetchWithTimeout("/api/drafter/parse-file", {
        method: "POST",
        body: formData,
      });

      const parseResult = await parseResponse.json();

      if (!parseResponse.ok) {
        setError(parseResult.error || "ファイルの読み込みに失敗しました");
        setStatusMessage(null);
        return;
      }

      setIsUploading(false);
      setIsExtracting(true);
      setStatusMessage("AIが会議情報を抽出中...");

      const extractResponse = await fetchWithTimeout("/api/drafter/extract-meeting-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: parseResult.content,
          fileName: file.name,
        }),
      });

      const extractResult = await extractResponse.json();

      if (!extractResponse.ok) {
        onChange(parseResult.content);
        setStatusMessage(null);
        setUploadedFileName(file.name);
        setError("AI抽出に失敗。元のテキストを表示。");
        return;
      }

      onChange(extractResult.extractedContent);
      setUploadedFileName(file.name);
      setStatusMessage(null);
    } catch (err) {
      console.error("File upload error:", err);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setError(isTimeout ? "タイムアウトしました（2分）。ファイルを小さくして再試行してください。" : "ファイルの読み込み中にエラーが発生しました");
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const isProcessing = isUploading || isExtracting;

  return (
    <div className="space-y-3">
      <FileDropzone
        accept=".pdf,.docx,.md,.txt,.json,.msg,.eml"
        onFilesSelected={handleFileUpload}
        uploading={isProcessing}
        label="ファイルをドラッグ&ドロップ"
        helperText="PDF, DOCX, TXT, MSG, EML 対応"
        featureText="✨ AIが会議情報を自動抽出"
      />

      {statusMessage && (
        <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <span className="animate-spin">⏳</span>
          {statusMessage}
        </div>
      )}

      {uploadedFileName && !statusMessage && !error && (
        <div className="text-xs text-green-600 dark:text-green-400">
          ✓ {uploadedFileName} から抽出しました
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// ========================================
// 設定の保存・読込
// ========================================

function ProjectOpenButton() {
  const { importProject, loadedFileName, clearProject } = useDrafter();
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    inputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("読み込み中...");
    const success = await importProject(file);
    setStatus(success ? "✓ 読み込み完了" : "✗ 失敗");
    setTimeout(() => setStatus(null), 2000);
    e.target.value = "";
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="px-2.5 py-2 flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-bold flex-shrink-0">①</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">プロジェクトを開く</h3>
            <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded leading-none">
              任意
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            プロジェクトを作っていなければ②へ
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />

        <button
          onClick={handleImportClick}
          className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
        >
          📂 開く
        </button>

        {loadedFileName && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-green-600 dark:text-green-400 truncate max-w-[120px]">
              ✓ {loadedFileName}
            </span>
            <button
              onClick={clearProject}
              className="text-xs text-slate-400 hover:text-red-500"
              title="クリア"
            >
              ×
            </button>
          </div>
        )}

        {status && (
          <span className={`text-xs flex-shrink-0 ${status.includes("✓") ? "text-green-600" : status.includes("✗") ? "text-red-600" : "text-blue-600"}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

// プロジェクト保存ボタン（右カラム最後に配置）
function ProjectSaveButton() {
  const { exportProject } = useDrafter();

  const handleExport = () => {
    exportProject("議事録プロジェクト");
  };

  return (
    <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
      <span className="flex items-center justify-center w-6 h-6 bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold">💾</span>
      <span className="text-sm text-slate-700 dark:text-slate-300">プロジェクトを保存</span>
      <button
        onClick={handleExport}
        className="ml-auto px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
      >
        保存
      </button>
    </div>
  );
}

// ========================================
// テンプレート選択（簡易版）
// ========================================

function TemplateSelector() {
  const {
    templates,
    selectedTemplate,
    loadTemplates,
    selectTemplate,
    addTemplate,
    deleteTemplate,
  } = useDrafter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<DrafterTemplate | null>(null);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);

  const handlePreview = (template: DrafterTemplate) => {
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("このテンプレートを削除しますか？")) {
      await deleteTemplate(id);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    console.log("=== Template File Upload Started ===");
    console.log("File:", file.name, file.size);

    setIsUploading(true);
    setExtractionStatus("ファイルを読み込み中...");
    try {
      // Step 1: ファイルをパース
      const formData = new FormData();
      formData.append("file", file);

      console.log("Calling parse-file API...");
      const parseResponse = await fetchWithTimeout("/api/drafter/parse-file", {
        method: "POST",
        body: formData,
      });

      const parseResult = await parseResponse.json();
      console.log("Parse result:", parseResponse.ok, parseResult?.content?.substring(0, 100));

      if (!parseResponse.ok) {
        setExtractionStatus("ファイルの読み込みに失敗しました");
        return;
      }

      // Step 2: AIでテンプレートを抽出
      setIsUploading(false);
      setIsExtracting(true);
      setExtractionStatus("AIがテンプレートを抽出中...");

      const extractResponse = await fetchWithTimeout("/api/drafter/extract-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: parseResult.content,
          fileName: file.name,
        }),
      });

      const extractResult = await extractResponse.json();
      console.log("Extract result:", extractResult);

      if (extractResponse.ok && extractResult.template) {
        // AI抽出成功
        console.log("Setting template content:", extractResult.template.substring(0, 100));
        setNewContent(extractResult.template);
        setExtractionStatus("✅ テンプレートを抽出しました");
        // 3秒後にステータスをクリア
        setTimeout(() => setExtractionStatus(null), 3000);
      } else {
        // AI抽出失敗時は元のコンテンツを使用
        console.warn("Template extraction failed, using raw content", extractResult);
        setNewContent(parseResult.content);
        setExtractionStatus("AI抽出に失敗。元のテキストを表示しています。");
      }

      if (!newName) {
        setNewName(file.name.replace(/\.[^/.]+$/, "") + "_テンプレート");
      }
    } catch (err) {
      console.error("File upload error:", err);
      const isTimeout = err instanceof Error && err.name === "AbortError";
      setExtractionStatus(isTimeout ? "タイムアウトしました（2分）。ファイルを小さくして再試行してください。" : "エラーが発生しました");
    } finally {
      console.log("=== Template File Upload Completed ===");
      console.log("Final newContent length:", newContent.length);
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    await addTemplate(newName.trim(), newContent.trim());
    setNewName("");
    setNewContent("");
    setShowAddForm(false);
  };

  // 会社テンプレート（将来的にはscope: "company"でフィルタ）
  const companyTemplates = templates.filter(t => t.isDefault);
  // 個人テンプレート
  const personalTemplates = templates.filter(t => !t.isDefault);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-2.5 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-bold">②</span>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">テンプレート</h3>
              <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded leading-none">
                任意
              </span>
              {selectedTemplate && (
                <span className="text-[11px] text-green-600 dark:text-green-400">
                  → {selectedTemplate.name}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              議事録の構成・フォーマットを定義
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* STEP 1: テンプレートを選択 */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              ① 使用するテンプレートを選択
            </p>

            {/* 共有テンプレート */}
            {companyTemplates.length > 0 && (
              <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  🏢 共有テンプレート
                </p>
                <div className="flex flex-wrap gap-2">
                  {companyTemplates.map((t) => (
                    <div key={t.id} className="flex items-center">
                      <button
                        onClick={() => selectTemplate(t)}
                        className={`px-3 py-1.5 text-sm rounded-l-lg transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-green-500 text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {t.name}
                      </button>
                      <button
                        onClick={() => handlePreview(t)}
                        className={`px-2 py-1.5 text-sm rounded-r-lg border-l transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 border-slate-200 dark:border-slate-600"
                        }`}
                        title="プレビュー"
                      >
                        👁
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* マイテンプレート */}
            <div className="pl-3 border-l-2 border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                👤 マイテンプレート
              </p>
              {personalTemplates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {personalTemplates.map((t) => (
                    <div key={t.id} className="flex items-center">
                      <button
                        onClick={() => selectTemplate(t)}
                        className={`px-3 py-1.5 text-sm rounded-l-lg transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-green-500 text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {t.name}
                      </button>
                      <button
                        onClick={() => handlePreview(t)}
                        className={`px-2 py-1.5 text-sm border-l transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-green-600 text-white border-green-600"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 border-slate-200 dark:border-slate-600"
                        }`}
                        title="プレビュー"
                      >
                        👁
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        className={`px-2 py-1.5 text-sm rounded-r-lg border-l transition-colors ${
                          selectedTemplate?.id === t.id
                            ? "bg-green-600 text-white border-green-600 hover:bg-red-500"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-slate-200 dark:border-slate-600"
                        }`}
                        title="削除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">なし</p>
              )}
            </div>
          </div>

          {/* プレビュー表示（選択時） */}
          {showPreview && previewTemplate && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  📄 {previewTemplate.name}
                </p>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-blue-400 hover:text-blue-600 text-lg"
                >
                  ×
                </button>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded border max-h-[150px] overflow-y-auto mb-2">
                <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-mono">
                  {previewTemplate.content}
                </pre>
              </div>
              <button
                onClick={() => {
                  selectTemplate(previewTemplate);
                  setShowPreview(false);
                }}
                className="w-full px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                ✓ このテンプレートを使用
              </button>
            </div>
          )}

          {/* 区切り線 + 新規作成セクション */}
          <div className="border-t border-dashed border-slate-300 dark:border-slate-600 pt-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              ② 適切なテンプレートがない場合
            </p>

            {/* 新規作成ボタン or フォーム */}
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-3 text-sm rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                + 新しいテンプレートを作成
              </button>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">新規テンプレート作成</p>
                  <button onClick={() => setShowAddForm(false)} className="text-green-400 hover:text-green-600 text-lg">×</button>
                </div>

                {/* 入力方法の選択 */}
                <div className="space-y-3">
                  {/* 方法1: ファイルから読み込み */}
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      📁 過去の議事録ファイルから作成（推奨）
                    </p>
                    <FileDropzone
                      accept=".pdf,.docx,.md,.txt"
                      onFilesSelected={handleFileUpload}
                      uploading={isUploading || isExtracting}
                      label="ファイルをドロップ or クリック"
                      helperText="AIが構造を抽出してテンプレート化"
                    />
                    {extractionStatus && (
                      <div className={`mt-2 flex items-center gap-2 text-xs ${
                        extractionStatus.includes("失敗") || extractionStatus.includes("エラー")
                          ? "text-amber-600 dark:text-amber-400"
                          : extractionStatus.includes("✅")
                            ? "text-green-600 dark:text-green-400"
                            : "text-blue-600 dark:text-blue-400"
                      }`}>
                        {(isUploading || isExtracting) && <span className="animate-spin">⏳</span>}
                        {extractionStatus}
                      </div>
                    )}
                  </div>

                  {/* 区切り */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="flex-1 border-t border-slate-300 dark:border-slate-600"></div>
                    <span>または</span>
                    <div className="flex-1 border-t border-slate-300 dark:border-slate-600"></div>
                  </div>

                  {/* 方法2: 手入力 */}
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      ✏️ 手入力でテンプレートを作成
                    </p>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="テンプレート名（例: 営業部定例会議用）"
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 mb-2"
                    />
                    <textarea
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      placeholder="# 会議名&#10;## 日時・場所&#10;## 参加者&#10;## 議題&#10;## 議論内容&#10;## 決定事項&#10;## 次回アクション"
                      rows={6}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 font-mono"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newContent.trim()}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  ✓ テンプレートを登録
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 過去の議事録入力
// ========================================

function PastMinutesInput() {
  const { meetingInput, addPastMinutes, removePastMinutes } = useDrafter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFilesUpload = async (files: File[]) => {
    setIsUploading(true);
    setError(null);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetchWithTimeout("/api/drafter/parse-file", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          setError(`${file.name}: ${result.error || "読み込み失敗"}`);
          continue;
        }

        const newFile: PastMinutesFile = {
          id: crypto.randomUUID(),
          fileName: file.name,
          content: result.content,
        };
        addPastMinutes(newFile);
      } catch (err) {
        console.error("File upload error:", err);
        const isTimeout = err instanceof Error && err.name === "AbortError";
        setError(`${file.name}: ${isTimeout ? "タイムアウト" : "読み込みエラー"}`);
      }
    }

    setIsUploading(false);
  };

  return (
    <div className="space-y-3">
      <FileDropzone
        accept=".pdf,.docx,.md,.txt,.json,.msg,.eml"
        multiple
        onFilesSelected={handleFilesUpload}
        uploading={isUploading}
        label="ファイルをドラッグ&ドロップ"
        helperText="PDF, DOCX, TXT, MSG, EML 対応"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {meetingInput.pastMinutes.length > 0 && (
        <div className="space-y-1">
          {meetingInput.pastMinutes.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg"
            >
              <span className="text-sm text-slate-700 dark:text-slate-300">
                📄 {file.fileName}
                <span className="text-xs text-slate-400 ml-2">
                  ({file.content.length.toLocaleString()}文字)
                </span>
              </span>
              <button
                onClick={() => removePastMinutes(file.id)}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========================================
// プレビュー・エクスポート
// ========================================

function PreviewExport() {
  const { currentDraft, setCurrentDraft } = useDrafter();
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null);

  if (!currentDraft) return null;

  const handleExportWord = async () => {
    setIsExporting(true);
    setDownloadedFile(null);
    try {
      const paragraphs = currentDraft.content.split("\n").map((line) => {
        return new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: "Yu Gothic",
              size: 24,
            }),
          ],
        });
      });

      const titleParagraph = new Paragraph({
        children: [
          new TextRun({
            text: currentDraft.title,
            font: "Yu Gothic",
            size: 32,
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

      const fileName = `${currentDraft.title || "document"}.docx`;
      const blob = await Packer.toBlob(doc);
      saveAs(blob, fileName);

      setDownloadedFile(fileName);
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
    const content = `${currentDraft.title}\n\n${currentDraft.content}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `${currentDraft.title || "document"}.txt`);
  };

  const handleExportMarkdown = () => {
    const content = `# ${currentDraft.title}\n\n${currentDraft.content}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${currentDraft.title || "document"}.md`);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${currentDraft.title}\n\n${currentDraft.content}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
          ✅ 生成完了
        </span>
        <button
          onClick={handleCopy}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            copied
              ? "bg-green-200 text-green-700"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
          }`}
        >
          {copied ? "コピーしました" : "📋 コピー"}
        </button>
      </div>

      {/* プレビュー */}
      <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border max-h-[300px] overflow-y-auto">
        <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-3">
          {currentDraft.title}
        </h4>
        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {currentDraft.content}
        </div>
      </div>

      {/* ダウンロード完了メッセージ */}
      {downloadedFile && (
        <div className="p-4 bg-blue-100 dark:bg-blue-900/40 rounded-lg border border-blue-300 dark:border-blue-700">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📥</span>
            <div className="flex-1">
              <p className="font-medium text-blue-800 dark:text-blue-200">
                ダウンロード完了！
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                📄 <span className="font-mono bg-blue-200 dark:bg-blue-800 px-1 rounded">{downloadedFile}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 ブラウザ下部のダウンロードバーからクリックして開けます
                </p>
              </div>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                または <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded border text-xs">J</kbd> でダウンロード履歴を開く
              </p>
            </div>
          </div>
        </div>
      )}

      {/* エクスポートボタン */}
      <div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
          Wordで保存後、Microsoft Copilotで編集できます
        </p>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleExportWord}
            disabled={isExporting}
            className={`p-3 border-2 rounded-lg text-center disabled:opacity-50 transition-colors ${
              downloadedFile
                ? "border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100"
                : "border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100"
            }`}
          >
            <div className="text-xl mb-1">{downloadedFile ? "✅" : "📘"}</div>
            <p className={`text-sm font-medium ${
              downloadedFile
                ? "text-green-700 dark:text-green-300"
                : "text-blue-700 dark:text-blue-300"
            }`}>
              {isExporting ? "保存中..." : downloadedFile ? "保存済み" : "Word"}
            </p>
          </button>
          <button
            onClick={handleExportText}
            className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-center"
          >
            <div className="text-xl mb-1">📄</div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">txt</p>
          </button>
          <button
            onClick={handleExportMarkdown}
            className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-center"
          >
            <div className="text-xl mb-1">📝</div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">md</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================================
// メインコンポーネント
// ========================================

export function MeetingWorkflowTab() {
  const {
    meetingInput,
    updateMeetingInput,
    generateDraft,
    generateStatus,
    currentDraft,
  } = useDrafter();

  // 会議情報は必須、文字起こしは任意
  const hasMeetingOverview = meetingInput.meetingOverview.trim() !== "";
  const hasMinimumInput = hasMeetingOverview;

  const handleGenerate = async () => {
    await generateDraft();
  };

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center text-xl">
            📝
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">議事録作成</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              情報を入力してAIが議事録を自動生成
            </p>
          </div>
        </div>
      </div>

      {/* フロー説明 */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm">
        <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
          <span className="font-bold">Step1</span> 入力して生成
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          <span className="font-bold">Step2</span> 結果を確認
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
          <span className="font-bold">Step3</span> 議事録を保存
        </span>
      </div>

      {/* 2カラムレイアウト - 画面いっぱいに */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
        {/* 左カラム: 入力 */}
        <div className="p-2 space-y-2 overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">

          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
            <span className="font-bold">Step1</span> 入力して生成
          </span>

          {/* ① プロジェクトを開く */}
          <ProjectOpenButton />

          {/* テンプレート選択 */}
          <TemplateSelector />

          {/* ③ 会議情報 */}
          <InputSection
            icon="📋"
            title="会議情報"
            description="日時・場所・参加者・議題など（形式自由 - AIが読み取ります）"
            action="ドキュメントをドロップまたはペースト → AIが自動抽出"
            optional={false}
            stepNumber="③"
          >
            <MeetingOverviewInput
              value={meetingInput.meetingOverview}
              onChange={(v) => updateMeetingInput("meetingOverview", v)}
            />
          </InputSection>

          {/* ④ 文字起こし・メモ */}
          <InputSection
            icon="🎙️"
            title="文字起こし / 会議メモ"
            description="録音の文字起こし、または会議中に取ったメモ"
            action="文字起こしテキストまたはメモをペースト"
            optional={false}
            stepNumber="④"
          >
            <FileOrTextInput
              value={meetingInput.transcript}
              onChange={(v) => updateMeetingInput("transcript", v)}
              placeholder="文字起こしテキスト、または会議メモを入力..."
              rows={3}
            />
          </InputSection>

          {/* ⑤ 過去の議事録 */}
          <InputSection
            icon="📁"
            title="過去の議事録（お手本）"
            description="文体やフォーマットの参考"
            action="過去の議事録ファイルをドロップ"
            defaultCollapsed={true}
            stepNumber="⑤"
          >
            <PastMinutesInput />
          </InputSection>

          {/* ⑥ 追加指示 */}
          <InputSection
            icon="✏️"
            title="追加指示"
            description="「箇条書きで」「決定事項を強調」など"
            action="生成時の注意点や要望を入力"
            defaultCollapsed={true}
            stepNumber="⑥"
          >
            <FileOrTextInput
              value={meetingInput.additionalInstructions}
              onChange={(v) => updateMeetingInput("additionalInstructions", v)}
              placeholder="追加の指示があれば入力..."
              rows={1}
            />
          </InputSection>

          {/* 生成ボタン */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={!hasMinimumInput || generateStatus === "running"}
              className="w-full px-6 py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
            >
              {generateStatus === "running" ? (
                <>
                  <span className="animate-spin">⏳</span>
                  生成中...
                </>
              ) : (
                <>
                  🤖 議事録を生成
                </>
              )}
            </button>
          </div>
        </div>

        {/* 右カラム: 生成結果 + 保存 */}
        <div className="p-4 space-y-4 overflow-y-auto bg-white dark:bg-slate-800">
          {/* Step2: 生成結果 */}
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
            <span className="font-bold">Step2</span> 結果を確認
          </span>

          {/* プレビュー */}
          {currentDraft ? (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[400px] overflow-y-auto">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-3">
                {currentDraft.title}
              </h4>
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {currentDraft.content}
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 bg-slate-100 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center flex flex-col items-center justify-center">
              <div className="text-5xl mb-4 opacity-20">📄</div>
              <p className="text-slate-400 dark:text-slate-500">
                左の入力を元に議事録を生成すると
              </p>
              <p className="text-slate-400 dark:text-slate-500">
                ここにプレビューが表示されます
              </p>
            </div>
          )}

          {/* Step3: 保存 - 常に表示 */}
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
            <span className="font-bold">Step3</span> 議事録を保存
          </span>
          {currentDraft ? (
            <PreviewExport />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              議事録を生成すると保存オプションが表示されます
            </p>
          )}

          {/* プロジェクトを保存（最後に配置） */}
          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
            <ProjectSaveButton />
          </div>
        </div>
      </div>
    </div>
  );
}
