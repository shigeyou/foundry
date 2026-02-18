"use client";

import { useState, useEffect } from "react";
import { useDrafter, PastMinutesFile, DrafterProject } from "@/contexts/DrafterContext";
import { FileDropzone } from "@/components/ui/file-dropzone";

// 入力セクションの共通コンポーネント
interface InputSectionProps {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
  optional?: boolean;
}

function InputSection({ icon, title, description, children, optional = true }: InputSectionProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
            {optional && (
              <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
                任意
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ファイル読み込み + テキスト入力の共通コンポーネント
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

      const response = await fetch("/api/drafter/parse-file", {
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
      setError("ファイルの読み込み中にエラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <FileDropzone
          accept=".pdf,.docx,.md,.txt,.json,.msg,.eml"
          onFilesSelected={handleFileUpload}
          uploading={isUploading}
          label="ファイルをここにドラッグ&ドロップ"
          compact
          className="flex-shrink-0"
        />
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {uploadedFileName ? (
            <span className="text-green-600 dark:text-green-400">
              {uploadedFileName} を読み込みました
            </span>
          ) : error ? (
            <span className="text-red-600 dark:text-red-400">{error}</span>
          ) : (
            <span>PDF, DOCX, MD, TXT, JSON, MSG, EML対応</span>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
      />
    </div>
  );
}

// 議事概要用の特別なファイル入力コンポーネント（AI抽出機能付き）
interface MeetingOverviewInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function MeetingOverviewInput({ value, onChange, placeholder }: MeetingOverviewInputProps) {
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
      // Step 1: Parse file
      const formData = new FormData();
      formData.append("file", file);

      const parseResponse = await fetch("/api/drafter/parse-file", {
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
      setStatusMessage("AIが議事概要を抽出中...");

      // Step 2: Extract meeting info using AI
      const extractResponse = await fetch("/api/drafter/extract-meeting-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: parseResult.content,
          fileName: file.name,
        }),
      });

      const extractResult = await extractResponse.json();

      if (!extractResponse.ok) {
        // AI抽出に失敗した場合は、生のコンテンツを表示
        onChange(parseResult.content);
        setStatusMessage(null);
        setUploadedFileName(file.name);
        setError("AI抽出に失敗しました。元のテキストを表示しています。");
        return;
      }

      onChange(extractResult.extractedContent);
      setUploadedFileName(file.name);
      setStatusMessage(null);
    } catch (err) {
      console.error("File upload error:", err);
      setError("ファイルの読み込み中にエラーが発生しました");
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  // クリップボードからテキストを貼り付けてAI抽出
  const handlePasteAndExtract = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setError("クリップボードにテキストがありません");
        return;
      }

      setError(null);
      setIsExtracting(true);
      setStatusMessage("AIが議事概要を抽出中...");

      const extractResponse = await fetch("/api/drafter/extract-meeting-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          fileName: "clipboard-paste",
        }),
      });

      const extractResult = await extractResponse.json();

      if (!extractResponse.ok) {
        onChange(text);
        setStatusMessage(null);
        setUploadedFileName(null);
        setError("AI抽出に失敗しました。貼り付けたテキストをそのまま表示しています。");
        return;
      }

      onChange(extractResult.extractedContent);
      setUploadedFileName(null);
      setStatusMessage(null);
    } catch (err) {
      // clipboard API が使えない場合のフォールバック
      console.error("Clipboard read error:", err);
      setError("クリップボードの読み取りに失敗しました。テキストエリアに直接貼り付けてください。");
      setStatusMessage(null);
    } finally {
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
        label="Outlookメールやドキュメントをドラッグ&ドロップ"
        helperText="Outlookメール(.msg), PDF, DOCX, MD, TXT等に対応 - AIが議事概要を自動抽出"
      />

      {/* テキストコピペ → AI抽出ボタン */}
      <button
        onClick={handlePasteAndExtract}
        disabled={isProcessing}
        className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border-2 border-dashed border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 hover:border-green-400 dark:hover:border-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        クリップボードから貼り付け → AI自動抽出
      </button>

      {statusMessage && (
        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <span className="animate-spin">⏳</span>
          {statusMessage}
        </div>
      )}

      {uploadedFileName && !statusMessage && !error && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <span>✓</span>
          <span>{uploadedFileName} から議事概要を抽出しました</span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={8}
        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
      />
    </div>
  );
}

// プロジェクト選択コンポーネント
function ProjectSelector() {
  const {
    projects,
    selectedProject,
    loadProjects,
    saveAsProject,
    selectProject,
    updateProject,
    deleteProject,
    clearProject,
  } = useDrafter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSave = async () => {
    if (!newProjectName.trim()) return;
    setIsSaving(true);
    await saveAsProject(newProjectName.trim());
    setNewProjectName("");
    setShowSaveDialog(false);
    setIsSaving(false);
  };

  const handleUpdate = async () => {
    if (!selectedProject) return;
    await updateProject(selectedProject.id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("このプロジェクトを削除しますか？")) {
      await deleteProject(id);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📂</span>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {selectedProject ? selectedProject.name : "プロジェクト"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {selectedProject
                ? "定型設定が適用されています"
                : "定例会議などの設定を保存・呼び出しできます"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <>
              <button
                onClick={handleUpdate}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="現在の設定でプロジェクトを更新"
              >
                更新
              </button>
              <button
                onClick={clearProject}
                className="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                クリア
              </button>
            </>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {isExpanded ? "閉じる" : projects.length > 0 ? `選択 (${projects.length})` : "新規作成"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* プロジェクト一覧 */}
          {projects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">保存済みプロジェクト</p>
              <div className="grid gap-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      selectedProject?.id === project.id
                        ? "bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                    onClick={() => selectProject(project)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">📋</span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {project.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 新規保存 */}
          {showSaveDialog ? (
            <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="プロジェクト名（例：月例営業会議）"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <button
                onClick={handleSave}
                disabled={!newProjectName.trim() || isSaving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setNewProjectName("");
                }}
                className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              <span>現在の設定を新規プロジェクトとして保存</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 過去の議事録（複数ファイル）入力コンポーネント
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

        const response = await fetch("/api/drafter/parse-file", {
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
        setError(`${file.name}: 読み込みエラー`);
      }
    }

    setIsUploading(false);
  };

  return (
    <div className="space-y-3">
      <FileDropzone
        accept=".pdf,.docx,.md,.txt,.json"
        multiple
        onFilesSelected={handleFilesUpload}
        uploading={isUploading}
        label="ファイルをドラッグ＆ドロップ（複数可）"
        helperText="PDF, DOCX, MD, TXT, JSON対応"
      />

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {meetingInput.pastMinutes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            アップロード済み（{meetingInput.pastMinutes.length}件）
          </p>
          <div className="space-y-1">
            {meetingInput.pastMinutes.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">📄</span>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{file.fileName}</span>
                  <span className="text-xs text-slate-400">
                    ({file.content.length.toLocaleString()}文字)
                  </span>
                </div>
                <button
                  onClick={() => removePastMinutes(file.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MeetingInputTab() {
  const { setActiveTab, meetingInput, updateMeetingInput, generateDraft, generateStatus } = useDrafter();

  // バリデーション: 議事概要か文字起こしのどちらかは入力必須
  const hasMinimumInput =
    meetingInput.meetingOverview.trim() !== "" ||
    meetingInput.transcript.trim() !== "";

  const handleGenerate = async () => {
    await generateDraft();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-3xl">
          📝
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">議事録作成 - 入力情報</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            必要な情報を入力して議事録を生成します
          </p>
        </div>
      </div>

      {/* プロジェクト選択 */}
      <ProjectSelector />

      {/* 1. 議事概要 */}
      <InputSection
        icon="📋"
        title="議事概要"
        description="会議の日時・場所・参加者・議題などの基本情報（メールやドキュメントからAIが自動抽出）"
      >
        <MeetingOverviewInput
          value={meetingInput.meetingOverview}
          onChange={(v) => updateMeetingInput("meetingOverview", v)}
          placeholder="例:
会議名: 2026年2月 定例会議
日時: 2026年2月1日 14:00〜15:30
場所: 本社会議室A
参加者: 山田部長、鈴木課長、田中主任
議題:
1. 前月の進捗報告
2. 今月の目標設定
3. 課題と対策の検討"
        />
      </InputSection>

      {/* 2. 文字起こし */}
      <InputSection
        icon="🎙️"
        title="文字起こし"
        description="会議録音の文字起こしテキスト（発言記録）"
      >
        <FileOrTextInput
          value={meetingInput.transcript}
          onChange={(v) => updateMeetingInput("transcript", v)}
          placeholder="例:
司会（山田部長）: それでは本日の会議を始めます。
鈴木課長: まず先月の売上について報告します。目標の95%を達成しました。
田中主任: 新規顧客からの問い合わせも増加傾向です。
..."
          rows={10}
        />
      </InputSection>

      {/* 3. 過去の議事録 */}
      <InputSection
        icon="📁"
        title="過去の議事録（お手本）"
        description="文体やフォーマットの参考として（複数ファイル可）"
      >
        <PastMinutesInput />
      </InputSection>

      {/* 4. 追加指示 */}
      <InputSection
        icon="✏️"
        title="追加指示"
        description="「箇条書きで」「決定事項を強調して」などの個別要望"
      >
        <FileOrTextInput
          value={meetingInput.additionalInstructions}
          onChange={(v) => updateMeetingInput("additionalInstructions", v)}
          placeholder="例:
・決定事項は太字で強調してください
・議論の要点を箇条書きでまとめてください
・次回の会議予定も記載してください"
          rows={4}
        />
      </InputSection>

      {/* バリデーションメッセージ */}
      {!hasMinimumInput && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            ※「議事概要」または「文字起こし」のどちらかを入力してください
          </p>
        </div>
      )}

      {/* ナビゲーション */}
      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab("template")}
          className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ← テンプレート
        </button>
        <button
          onClick={handleGenerate}
          disabled={!hasMinimumInput || generateStatus === "running"}
          className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2"
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
  );
}
