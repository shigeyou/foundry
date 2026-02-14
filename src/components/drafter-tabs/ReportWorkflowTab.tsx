"use client";

import { useState, useCallback } from "react";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { AudioRecorder } from "./AudioRecorder";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import {
  getFileCategory,
  fileToBase64,
  formatFileSize,
  ACCEPTED_FILE_TYPES,
  type FileCategory,
} from "@/lib/file-utils";
import { SAMPLE_PATTERNS } from "./report-sample-data";

// ========================================
// 型定義
// ========================================

interface MaterialItem {
  id: string;
  fileName: string;
  fileType: FileCategory;
  base64?: string;
  mimeType?: string;
  textContent?: string;
  memo: string;
  status: "processing" | "ready" | "error";
  error?: string;
  thumbnailUrl?: string;
  audioUrl?: string;
  fileSize?: number;
}

interface DraftImage {
  fileName: string;
  base64: string;
  memo: string;
}

interface DraftData {
  id: string;
  title: string;
  content: string;
  images: DraftImage[];
}

// ========================================
// メインコンポーネント
// ========================================

export function ReportWorkflowTab() {
  const [reportTitle, setReportTitle] = useState("");
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generateStatus, setGenerateStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const [currentDraft, setCurrentDraft] = useState<DraftData | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ファイル処理
  const processFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const category = getFileCategory(file.name);

    const newItem: MaterialItem = {
      id,
      fileName: file.name,
      fileType: category === "unknown" ? "document" : category,
      memo: "",
      status: "processing",
      fileSize: file.size,
    };

    setMaterials((prev) => [...prev, newItem]);

    try {
      if (category === "image") {
        const base64 = await fileToBase64(file);
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, base64, mimeType: file.type, thumbnailUrl: base64, status: "ready" }
              : m
          )
        );
      } else if (category === "audio") {
        // 音声ファイル: 文字起こし
        const audioUrl = URL.createObjectURL(file);
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? { ...m, audioUrl, status: "processing" } : m))
        );

        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/drafter/transcribe", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: "error", error: data.error || "文字起こし失敗" } : m
            )
          );
          return;
        }

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, textContent: data.text, status: "ready" } : m
          )
        );
      } else if (category === "spreadsheet") {
        // Excel/CSV
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/drafter/parse-excel", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: "error", error: data.error || "解析失敗" } : m
            )
          );
          return;
        }

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, textContent: data.content, status: "ready" } : m
          )
        );
      } else {
        // 文書ファイル (PDF, DOCX, TXT, etc.)
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/drafter/parse-file", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) {
          setMaterials((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, status: "error", error: data.error || "解析失敗" } : m
            )
          );
          return;
        }

        setMaterials((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, textContent: data.content, status: "ready" } : m
          )
        );
      }
    } catch (err) {
      console.error("File processing error:", err);
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "error", error: "処理中にエラーが発生しました" } : m
        )
      );
    }
  }, []);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      for (const file of files) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleRecordingComplete = useCallback(
    (file: File) => {
      processFile(file);
    },
    [processFile]
  );

  const removeMaterial = useCallback((id: string) => {
    setMaterials((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item?.audioUrl) URL.revokeObjectURL(item.audioUrl);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const updateMemo = useCallback((id: string, memo: string) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, memo } : m)));
  }, []);

  const updateTextContent = useCallback((id: string, textContent: string) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, textContent } : m)));
  }, []);

  // Unsplash / ストック画像を取得して素材に追加
  const [stockQuery, setStockQuery] = useState("ship inspection maritime");
  const [stockLoading, setStockLoading] = useState(false);
  const [showStockPanel, setShowStockPanel] = useState(false);

  const fetchStockImages = useCallback(async (query: string, count: number = 3) => {
    setStockLoading(true);
    try {
      const res = await fetch(`/api/drafter/stock-images?query=${encodeURIComponent(query)}&count=${count}`);
      const data = await res.json();
      if (!res.ok || !data.images) {
        console.error("Stock image fetch failed:", data.error);
        return;
      }

      const newMaterials: MaterialItem[] = data.images.map((img: { id: string; description: string; base64: string; mimeType: string; credit: string }) => ({
        id: crypto.randomUUID(),
        fileName: `${img.description.slice(0, 30)}.jpg`,
        fileType: "image" as FileCategory,
        memo: img.credit,
        status: "ready" as const,
        fileSize: Math.round(img.base64.length * 0.75),
        base64: img.base64,
        mimeType: img.mimeType,
        thumbnailUrl: img.base64,
      }));

      setMaterials((prev) => [...prev, ...newMaterials]);
      setShowStockPanel(false);
    } catch (err) {
      console.error("Stock image error:", err);
    } finally {
      setStockLoading(false);
    }
  }, []);

  // 報告書生成
  const handleGenerate = async () => {
    setGenerateStatus("running");
    setGenerateError(null);

    try {
      const readyMaterials = materials.filter((m) => m.status === "ready");

      const res = await fetch("/api/drafter/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportTitle,
          materials: readyMaterials.map((m) => ({
            id: m.id,
            fileName: m.fileName,
            fileType: m.fileType,
            base64: m.base64,
            mimeType: m.mimeType,
            textContent: m.textContent,
            memo: m.memo || undefined,
          })),
          additionalInstructions: additionalInstructions || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenerateStatus("error");
        setGenerateError(data.error || "生成に失敗しました");
        return;
      }

      // 画像素材をドラフトに保持（プレビュー表示用）
      const draftImages: DraftImage[] = readyMaterials
        .filter((m) => m.fileType === "image" && m.base64)
        .map((m) => ({
          fileName: m.fileName,
          base64: m.base64!,
          memo: m.memo,
        }));

      setCurrentDraft({ ...data, images: draftImages });
      setGenerateStatus("completed");
    } catch (err) {
      console.error("Generate error:", err);
      setGenerateStatus("error");
      setGenerateError("報告書の生成中にエラーが発生しました");
    }
  };

  // サンプルデータ選択メニュー表示
  const [showSampleMenu, setShowSampleMenu] = useState(false);

  // サンプルデータ投入（パターン選択式）
  const loadSampleData = useCallback(async (patternId: string) => {
    const pattern = SAMPLE_PATTERNS.find((p) => p.id === patternId);
    if (!pattern) return;

    setShowSampleMenu(false);
    setReportTitle(pattern.reportTitle);
    setAdditionalInstructions(pattern.additionalInstructions);

    // Canvas APIでサンプル画像を生成
    const generatedImages = pattern.generateImages();

    // 画像素材
    const imageMaterials: MaterialItem[] = generatedImages.map((img) => ({
      id: crypto.randomUUID(),
      fileName: img.fileName,
      fileType: "image" as FileCategory,
      memo: img.memo,
      status: "ready" as const,
      fileSize: Math.round(img.base64.length * 0.75),
      base64: img.base64,
      mimeType: "image/png",
      thumbnailUrl: img.base64,
    }));

    // テキスト素材
    const textMaterials: MaterialItem[] = pattern.materials.map((m) => ({
      id: crypto.randomUUID(),
      fileName: m.fileName,
      fileType: m.fileType,
      memo: m.memo,
      status: "ready" as const,
      fileSize: m.fileSize,
      textContent: m.textContent,
      base64: m.base64,
      mimeType: m.mimeType,
      thumbnailUrl: m.base64,
    }));

    setMaterials([...imageMaterials, ...textMaterials]);

    // Unsplash/Picsumからストック画像を取得して追加
    try {
      const res = await fetch(`/api/drafter/stock-images?query=${encodeURIComponent(pattern.stockQuery)}&count=2`);
      const data = await res.json();
      if (res.ok && data.images?.length > 0) {
        const stockMaterials: MaterialItem[] = data.images.map((img: { id: string; description: string; base64: string; mimeType: string; credit: string }, idx: number) => ({
          id: crypto.randomUUID(),
          fileName: `参考写真_${idx + 1}.jpg`,
          fileType: "image" as FileCategory,
          memo: img.credit,
          status: "ready" as const,
          fileSize: Math.round(img.base64.length * 0.75),
          base64: img.base64,
          mimeType: img.mimeType,
          thumbnailUrl: img.base64,
        }));
        setMaterials((prev) => [...prev, ...stockMaterials]);
      }
    } catch {
      // ストック画像取得に失敗してもサンプルデータ自体は使える
    }
  }, []);

  const readyCount = materials.filter((m) => m.status === "ready").length;
  const processingCount = materials.filter((m) => m.status === "processing").length;
  const hasMinimumInput = reportTitle.trim() !== "" && readyCount > 0;
  const imageCount = materials.filter((m) => m.fileType === "image").length;

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center text-xl">
            📊
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              マルチモーダル報告書作成
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              画像・文書・音声・表データを投入するだけでAIが報告書を自動生成
            </p>
          </div>
        </div>
        {materials.length === 0 && (
          <div className="relative">
            <button
              onClick={() => setShowSampleMenu(!showSampleMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              サンプルデータで試す
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showSampleMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">サンプルパターンを選択</span>
                </div>
                {SAMPLE_PATTERNS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadSampleData(p.id)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{p.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{p.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* フロー */}
      <div className="flex items-center justify-center gap-2 py-2 px-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm">
        <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
          <span className="font-bold">Step1</span> 素材を投入
        </span>
        <span className="text-slate-400">&rarr;</span>
        <span className="flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          <span className="font-bold">Step2</span> AIが報告書を生成
        </span>
        <span className="text-slate-400">&rarr;</span>
        <span className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
          <span className="font-bold">Step3</span> 保存
        </span>
      </div>

      {/* 2カラム */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
        {/* 左カラム: 入力 */}
        <div className="p-3 space-y-3 overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
            <span className="font-bold">Step1</span> 素材を投入
          </span>

          {/* 報告書タイトル */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-1">
              報告書タイトル
              <span className="text-[10px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-medium ml-2">
                必須
              </span>
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="例: 2026年1月度 業務報告書"
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
            />
          </div>

          {/* ドロップゾーン */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              素材を投入
              <span className="text-[10px] px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded font-medium ml-2">
                必須
              </span>
            </label>
            <FileDropzone
              accept={ACCEPTED_FILE_TYPES}
              multiple
              onFilesSelected={handleFilesSelected}
              label="何でもドロップ: 画像・文書・音声・Excel"
              helperText="JPG, PNG, PDF, DOCX, XLSX, CSV, MP3, WAV, M4A, TXT 等"
            />

            {imageCount > 10 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                画像は10枚まで報告書に反映されます（現在 {imageCount}枚）
              </p>
            )}
          </div>

          {/* ストック画像（Unsplash） */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                ストック画像を追加
                <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded ml-1">
                  任意
                </span>
              </label>
              <button
                onClick={() => setShowStockPanel(!showStockPanel)}
                className="text-xs px-2 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
              >
                {showStockPanel ? "閉じる" : "Unsplashから検索"}
              </button>
            </div>

            {showStockPanel && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={stockQuery}
                    onChange={(e) => setStockQuery(e.target.value)}
                    placeholder="検索キーワード（英語推奨）"
                    className="flex-1 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && stockQuery.trim()) {
                        fetchStockImages(stockQuery.trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => fetchStockImages(stockQuery.trim())}
                    disabled={stockLoading || !stockQuery.trim()}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {stockLoading ? (
                      <>
                        <span className="animate-spin text-xs">{"\u23F3"}</span>
                        取得中...
                      </>
                    ) : (
                      "取得"
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {["ship engine room", "cargo ship", "ship deck inspection", "port crane", "maritime navigation"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setStockQuery(q); fetchStockImages(q); }}
                      disabled={stockLoading}
                      className="px-2 py-0.5 text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  Unsplash APIキー設定時はUnsplashから取得。未設定時はLorem Picsumからサンプル画像を取得します。
                </p>
              </div>
            )}
          </div>

          {/* マイク録音 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-2">
              音声メモ
              <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded ml-2">
                任意
              </span>
            </label>
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              disabled={generateStatus === "running"}
            />
          </div>

          {/* 投入済み素材一覧 */}
          {materials.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-900 dark:text-white">
                  投入済み素材 ({readyCount}件
                  {processingCount > 0 && ` / 処理中${processingCount}件`})
                </label>
                {materials.length > 0 && (
                  <button
                    onClick={() => setMaterials([])}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    全て削除
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {materials.map((item) => (
                  <MaterialCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeMaterial(item.id)}
                    onMemoChange={(memo) => updateMemo(item.id, memo)}
                    onTextContentChange={(text) => updateTextContent(item.id, text)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 追加指示 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <label className="block text-sm font-bold text-slate-900 dark:text-white mb-1">
              追加指示
              <span className="text-[10px] px-1 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded ml-2">
                任意
              </span>
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="例: 箇条書きでまとめてほしい、グラフの数値を強調してほしい、等"
              rows={2}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* 生成ボタン */}
          <div className="pt-1">
            <button
              onClick={handleGenerate}
              disabled={!hasMinimumInput || generateStatus === "running" || processingCount > 0}
              className="w-full px-6 py-4 bg-green-600 text-white text-lg font-bold rounded-xl hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
            >
              {generateStatus === "running" ? (
                <>
                  <span className="animate-spin">{"\u23F3"}</span>
                  AIが報告書を生成中...
                </>
              ) : processingCount > 0 ? (
                <>
                  <span className="animate-spin">{"\u23F3"}</span>
                  素材を処理中... ({processingCount}件)
                </>
              ) : (
                <>{"\uD83E\uDD16"} 報告書を生成する</>
              )}
            </button>
            {generateError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{generateError}</p>
            )}
          </div>
        </div>

        {/* 右カラム: 結果 */}
        <div className="p-4 space-y-4 overflow-y-auto bg-white dark:bg-slate-800">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
            <span className="font-bold">Step2</span> 結果を確認
          </span>

          {currentDraft ? (
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-3">
                {currentDraft.title}
              </h4>
              <ReportPreview content={currentDraft.content} images={currentDraft.images} />
            </div>
          ) : (
            <div className="flex-1 p-8 bg-slate-100 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-center flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-5xl mb-4 opacity-20">{"\uD83D\uDCC4"}</div>
              <p className="text-slate-400 dark:text-slate-500">
                素材を投入して「報告書を生成する」を押すと
              </p>
              <p className="text-slate-400 dark:text-slate-500">
                ここに報告書ドラフトが表示されます
              </p>
            </div>
          )}

          <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
            <span className="font-bold">Step3</span> 報告書を保存
          </span>

          {currentDraft ? (
            <ReportExport draft={currentDraft} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              報告書を生成すると保存オプションが表示されます
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// 報告書プレビュー（画像埋め込み対応）
// ========================================

// 簡易Markdownインラインレンダリング（太字・斜体・コード）
function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // **bold**, *italic*, `code` のパターン
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let partIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t${partIdx++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[2]) {
      parts.push(<strong key={`${keyPrefix}-b${partIdx++}`} className="font-bold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`${keyPrefix}-i${partIdx++}`}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={`${keyPrefix}-c${partIdx++}`} className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-te`}>{text.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? parts : [<span key={`${keyPrefix}-raw`}>{text}</span>];
}

function ReportPreview({ content, images }: { content: string; images: DraftImage[] }) {
  if (!content) return null;

  // 正規化関数: スペース・全角半角を統一
  const normalize = (s: string) =>
    s.replace(/\s+/g, "")
      .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .toLowerCase();

  // ファイル名→画像データのマップ
  const imageMap = new Map<string, DraftImage>();
  for (const img of images) {
    imageMap.set(img.fileName, img);
    const noExt = img.fileName.replace(/\.[^.]+$/, "");
    imageMap.set(noExt, img);
    imageMap.set(normalize(img.fileName), img);
    imageMap.set(normalize(noExt), img);
  }

  const findImage = (refName: string): DraftImage | undefined => {
    const clean = refName.trim();
    if (imageMap.has(clean)) return imageMap.get(clean);
    if (imageMap.has(normalize(clean))) return imageMap.get(normalize(clean));
    const refNorm = normalize(clean);
    for (const img of images) {
      const imgNorm = normalize(img.fileName);
      const imgNoExt = normalize(img.fileName.replace(/\.[^.]+$/, ""));
      if (imgNorm.includes(refNorm) || refNorm.includes(imgNorm) ||
          imgNoExt.includes(refNorm) || refNorm.includes(imgNoExt)) {
        return img;
      }
    }
    return undefined;
  };

  // ========================================
  // Phase 1: コンテンツ前処理 → マーカーで分割
  // ========================================
  let processed = content;
  // 全角括弧・コロンを半角に
  processed = processed.replace(/[\uff3b\u3010]/g, "[").replace(/[\uff3d\u3011]/g, "]");
  processed = processed.replace(/[\uff1a\u2236]/g, ":");
  // ![IMAGE:...](url) → [IMAGE:...]  (Markdown画像リンク形式を除去)
  processed = processed.replace(/!\[IMAGE:\s*([^\]]+?)\s*\]\([^)]*\)/gi, "[IMAGE:$1]");
  // ![IMAGE:...] → [IMAGE:...]
  processed = processed.replace(/!\[IMAGE/gi, "[IMAGE");
  // [IMAGE:...](url) → [IMAGE:...]  (Markdownリンク形式を除去)
  processed = processed.replace(/(\[IMAGE:\s*[^\]]+?\s*\])\([^)]*\)/gi, "$1");
  // **[IMAGE:...]** / `[IMAGE:...]` / _[IMAGE:...]_ / \[IMAGE:...\]
  processed = processed.replace(/\*{1,2}\s*(\[IMAGE:[^\]]+\])\s*\*{1,2}/g, "$1");
  processed = processed.replace(/`(\[IMAGE:[^\]]+\])`/g, "$1");
  processed = processed.replace(/_\s*(\[IMAGE:[^\]]+\])\s*_/g, "$1");
  processed = processed.replace(/\\(\[IMAGE:[^\]]+\\])/g, (_, m) => m.replace(/\\/g, ""));
  // バックスラッシュエスケープ: \[IMAGE:...\] → [IMAGE:...]
  processed = processed.replace(/\\\[IMAGE:/gi, "[IMAGE:");
  processed = processed.replace(/(\[IMAGE:[^\\\]]+)\\\]/g, "$1]");

  // 超柔軟マーカー: [IMAGE: ...] [image: ...] など大文字小文字・スペース問わず検出
  const MARKER_GLOBAL = /\[IMAGE:\s*([^\]]+?)\s*\]/gi;

  // コンテンツをマーカーで分割 → [テキスト, マーカーref, テキスト, マーカーref, ...]
  const segments: { type: "text" | "image"; value: string }[] = [];
  let lastIdx = 0;
  const usedFileNames = new Set<string>();

  for (const match of processed.matchAll(MARKER_GLOBAL)) {
    if (match.index! > lastIdx) {
      segments.push({ type: "text", value: processed.slice(lastIdx, match.index!) });
    }
    segments.push({ type: "image", value: match[1].trim() });
    lastIdx = match.index! + match[0].length;
  }
  if (lastIdx < processed.length) {
    segments.push({ type: "text", value: processed.slice(lastIdx) });
  }

  // デバッグログ
  if (typeof window !== "undefined" && images.length > 0) {
    const imgSegs = segments.filter((s) => s.type === "image");
    console.log("[ReportPreview] 画像数:", images.length, "マーカー検出数:", imgSegs.length);
    console.log("[ReportPreview] 画像ファイル名:", images.map((i) => i.fileName));
    imgSegs.forEach((s) => {
      const found = findImage(s.value);
      console.log(`  マーカー: "${s.value}" → ${found ? "OK " + found.fileName : "NG"}`);
    });
    if (imgSegs.length === 0) {
      // 前処理前のcontentでもマーカーを探す
      const rawMatches = [...content.matchAll(/IMAGE/gi)];
      console.log("[ReportPreview] マーカー0件。前処理前のIMAGE出現数:", rawMatches.length);
      if (rawMatches.length > 0) {
        rawMatches.forEach((m) => {
          const start = Math.max(0, m.index! - 20);
          const end = Math.min(content.length, m.index! + 60);
          console.log(`  前後コンテキスト: "${content.slice(start, end).replace(/\n/g, "\\n")}"`);
        });
      }
      console.log("[ReportPreview] 前処理後の冒頭300文字:", processed.slice(0, 300));
    }
  }

  // ========================================
  // Phase 2: 各セグメントをレンダリング
  // ========================================
  const elements: React.ReactNode[] = [];

  // 画像レンダリング
  const renderImageMarker = (refName: string, key: string) => {
    const img = findImage(refName);
    if (img) {
      usedFileNames.add(img.fileName);
      return (
        <div key={key} className="my-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.base64} alt={img.fileName} className="max-w-full h-auto rounded shadow-sm" />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">{img.memo || img.fileName}</p>
        </div>
      );
    }
    return (
      <p key={key} className="text-xs text-amber-500 italic my-1">
        [画像: {refName} - 一致なし]
      </p>
    );
  };

  // Markdownテキストセグメントをレンダリング
  const renderTextSegment = (text: string, segIdx: number) => {
    const lines = text.split("\n");
    let tableBuffer: string[] = [];

    const flushTable = () => {
      if (tableBuffer.length === 0) return;
      const rows = tableBuffer.map((row) =>
        row.split("|").filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((c) => c.trim())
      );
      const sepIdx = rows.findIndex((r) => r.every((c) => /^[-:]+$/.test(c)));
      const headerRows = sepIdx > 0 ? rows.slice(0, sepIdx) : [];
      const dataRows = sepIdx >= 0 ? rows.slice(sepIdx + 1) : rows;
      const tblKey = `tbl-${segIdx}-${elements.length}`;

      elements.push(
        <div key={tblKey} className="my-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-300 dark:border-slate-600">
            {headerRows.length > 0 && (
              <thead>
                {headerRows.map((r, ri) => (
                  <tr key={ri} className="bg-slate-100 dark:bg-slate-700">
                    {r.map((c, ci) => (
                      <th key={ci} className="px-2 py-1 border border-slate-300 dark:border-slate-600 font-bold text-left">
                        {renderInlineMarkdown(c, `th-${tblKey}-${ri}-${ci}`)}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
            )}
            <tbody>
              {dataRows.map((r, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "" : "bg-slate-50 dark:bg-slate-800/50"}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 border border-slate-300 dark:border-slate-600">
                      {renderInlineMarkdown(c, `td-${tblKey}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableBuffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const k = `${segIdx}-${i}`;

      // テーブル行
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        tableBuffer.push(trimmed);
        continue;
      } else {
        flushTable();
      }

      // 空行
      if (trimmed === "") { elements.push(<div key={`bl-${k}`} className="h-2" />); continue; }

      // 見出し
      const hm = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        const cls: Record<number, string> = {
          1: "text-xl font-bold mt-5 mb-2 pb-1 border-b border-slate-300 dark:border-slate-600",
          2: "text-lg font-bold mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-slate-700",
          3: "text-base font-bold mt-3 mb-1",
          4: "text-sm font-bold mt-2 mb-1",
          5: "text-xs font-bold mt-2 mb-1",
          6: "text-xs font-bold mt-1 mb-1 text-slate-500",
        };
        elements.push(
          <div key={`h-${k}`} className={`${cls[hm[1].length] || cls[4]} text-slate-900 dark:text-white`}>
            {renderInlineMarkdown(hm[2], `h-${k}`)}
          </div>
        );
        continue;
      }

      // 水平線
      if (/^[-*_]{3,}\s*$/.test(trimmed)) {
        elements.push(<hr key={`hr-${k}`} className="my-3 border-slate-300 dark:border-slate-600" />);
        continue;
      }

      // 箇条書き
      const bm = trimmed.match(/^[-*+]\s+(.+)$/);
      if (bm) {
        elements.push(
          <div key={`li-${k}`} className="flex gap-2 ml-4 my-0.5 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-400 select-none">{"\u2022"}</span>
            <span>{renderInlineMarkdown(bm[1], `li-${k}`)}</span>
          </div>
        );
        continue;
      }

      // 番号付きリスト
      const nm = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
      if (nm) {
        elements.push(
          <div key={`ol-${k}`} className="flex gap-2 ml-4 my-0.5 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-slate-500 select-none min-w-[1.5em] text-right">{nm[1]}.</span>
            <span>{renderInlineMarkdown(nm[2], `ol-${k}`)}</span>
          </div>
        );
        continue;
      }

      // 引用
      if (trimmed.startsWith(">")) {
        elements.push(
          <div key={`bq-${k}`} className="ml-2 pl-3 border-l-3 border-slate-400 dark:border-slate-500 text-sm text-slate-600 dark:text-slate-400 italic my-1">
            {renderInlineMarkdown(trimmed.replace(/^>\s*/, ""), `bq-${k}`)}
          </div>
        );
        continue;
      }

      // 通常テキスト
      elements.push(
        <p key={`p-${k}`} className="text-sm text-slate-700 dark:text-slate-300 my-0.5 leading-relaxed">
          {renderInlineMarkdown(lines[i], `p-${k}`)}
        </p>
      );
    }
    flushTable();
  };

  // セグメントを順に処理
  segments.forEach((seg, idx) => {
    if (seg.type === "image") {
      elements.push(renderImageMarker(seg.value, `marker-${idx}`));
    } else {
      renderTextSegment(seg.value, idx);
    }
  });

  // マーカーで参照されなかった画像を末尾に添付
  const unusedImages = images.filter((img) => !usedFileNames.has(img.fileName));

  return (
    <div>
      <div>{elements}</div>

      {unusedImages.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
            添付画像
          </h5>
          <div className="grid grid-cols-2 gap-3">
            {unusedImages.map((img, idx) => (
              <div key={`attach-${idx}`} className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.base64}
                  alt={img.fileName}
                  className="w-full h-auto rounded shadow-sm"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                  {img.memo || img.fileName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 素材カード
// ========================================

function MaterialCard({
  item,
  onRemove,
  onMemoChange,
  onTextContentChange,
}: {
  item: MaterialItem;
  onRemove: () => void;
  onMemoChange: (memo: string) => void;
  onTextContentChange: (text: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);

  const typeIcon =
    item.fileType === "image" ? "\uD83D\uDCF7" :
    item.fileType === "audio" ? "\uD83C\uDFA4" :
    item.fileType === "spreadsheet" ? "\uD83D\uDCCA" : "\uD83D\uDCC4";

  const statusBadge =
    item.status === "processing" ? (
      <span className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded animate-pulse">
        処理中...
      </span>
    ) : item.status === "error" ? (
      <span className="text-[10px] px-1 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded">
        エラー
      </span>
    ) : null;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
      <div className="flex items-start gap-2">
        {/* サムネイル or アイコン */}
        {item.fileType === "image" && item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt={item.fileName}
            className="w-12 h-12 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center text-xl flex-shrink-0"
            dangerouslySetInnerHTML={{ __html: typeIcon }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
              {item.fileName}
            </span>
            {statusBadge}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{item.fileSize ? formatFileSize(item.fileSize) : ""}</span>
            {item.textContent && (
              <span>{item.textContent.length.toLocaleString()}文字</span>
            )}
          </div>

          {item.error && (
            <p className="text-xs text-red-500 mt-1">{item.error}</p>
          )}

          {/* 音声再生 */}
          {item.fileType === "audio" && item.audioUrl && (
            <audio controls className="w-full h-8 mt-1" src={item.audioUrl} />
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(item.textContent || item.fileType === "audio") && (
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {showDetail ? "閉じる" : "詳細"}
            </button>
          )}
          <button
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      </div>

      {/* メモ */}
      <input
        type="text"
        value={item.memo}
        onChange={(e) => onMemoChange(e.target.value)}
        placeholder="このファイルの説明（任意）"
        className="w-full mt-1.5 px-2 py-1 text-xs border rounded bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
      />

      {/* 詳細表示（テキスト内容の確認・編集） */}
      {showDetail && item.textContent && (
        <textarea
          value={item.textContent}
          onChange={(e) => onTextContentChange(e.target.value)}
          rows={4}
          className="w-full mt-1.5 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-mono resize-y"
        />
      )}
    </div>
  );
}

// ========================================
// エクスポート
// ========================================

function ReportExport({ draft }: { draft: DraftData }) {
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState<string | null>(null);

  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      const paragraphs = draft.content.split("\n").map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: "Yu Gothic", size: 24 })],
          })
      );
      const titleParagraph = new Paragraph({
        children: [new TextRun({ text: draft.title, font: "Yu Gothic", size: 32, bold: true })],
      });
      const doc = new Document({
        sections: [{ children: [titleParagraph, new Paragraph({ text: "" }), ...paragraphs] }],
      });
      const fileName = `${draft.title || "report"}.docx`;
      const blob = await Packer.toBlob(doc);
      saveAs(blob, fileName);
      setDownloadedFile(fileName);
    } catch (error) {
      console.error("Export failed:", error);
      alert("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportText = () => {
    const blob = new Blob([`${draft.title}\n\n${draft.content}`], {
      type: "text/plain;charset=utf-8",
    });
    saveAs(blob, `${draft.title || "report"}.txt`);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([`# ${draft.title}\n\n${draft.content}`], {
      type: "text/markdown;charset=utf-8",
    });
    saveAs(blob, `${draft.title || "report"}.md`);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${draft.title}\n\n${draft.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
          {"\u2705"} 生成完了
        </span>
        <button
          onClick={handleCopy}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            copied
              ? "bg-green-200 text-green-700"
              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
          }`}
        >
          {copied ? "\u2705 コピーしました" : "\uD83D\uDCCB コピー"}
        </button>
      </div>

      {downloadedFile && (
        <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg border border-blue-300 dark:border-blue-700">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {"\uD83D\uDCE5"} <span className="font-mono">{downloadedFile}</span> をダウンロードしました
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={handleExportWord}
          disabled={isExporting}
          className={`p-3 border-2 rounded-lg text-center disabled:opacity-50 transition-colors ${
            downloadedFile
              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
              : "border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100"
          }`}
        >
          <div className="text-xl mb-1">{downloadedFile ? "\u2705" : "\uD83D\uDCD8"}</div>
          <p
            className={`text-sm font-medium ${
              downloadedFile
                ? "text-green-700 dark:text-green-300"
                : "text-blue-700 dark:text-blue-300"
            }`}
          >
            {isExporting ? "保存中..." : downloadedFile ? "保存済み" : "Word"}
          </p>
        </button>
        <button
          onClick={handleExportText}
          className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-center"
        >
          <div className="text-xl mb-1">{"\uD83D\uDCC4"}</div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">txt</p>
        </button>
        <button
          onClick={handleExportMarkdown}
          className="p-3 border border-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-center"
        >
          <div className="text-xl mb-1">{"\uD83D\uDCDD"}</div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">md</p>
        </button>
      </div>
    </div>
  );
}
