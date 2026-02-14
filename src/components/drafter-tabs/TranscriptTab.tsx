"use client";

import { useRef, useState } from "react";
import { useDrafter } from "@/contexts/DrafterContext";

export function TranscriptTab() {
  const {
    setActiveTab,
    drafterId,
    transcriptText,
    setTranscriptText,
    extractStatus,
    extractFromTranscript,
    inputFields,
  } = useDrafter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // 議事録ドラフター以外では表示しない
  if (drafterId !== "minutes") {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
          <p className="text-slate-500 dark:text-slate-400">
            この機能は議事録ドラフターでのみ使用できます。
          </p>
          <button
            onClick={() => setActiveTab("input")}
            className="mt-4 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            入力情報へ進む →
          </button>
        </div>
      </div>
    );
  }

  // ファイルアップロード処理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("読み込み中...");

    try {
      // テキストファイルの場合
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text();
        setTranscriptText(text);
        setUploadStatus(`${file.name} を読み込みました（${text.length.toLocaleString()}文字）`);
      }
      // Wordファイルの場合（.docx）- サーバーサイドで処理
      else if (file.name.endsWith(".docx")) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/drafter/parse-docx", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setTranscriptText(data.text);
          setUploadStatus(`${file.name} を読み込みました（${data.text.length.toLocaleString()}文字）`);
        } else {
          setUploadStatus("Word文書の読み込みに失敗しました");
        }
      }
      // その他のファイル
      else {
        setUploadStatus("サポートされていないファイル形式です（.txt または .docx を使用してください）");
      }
    } catch (error) {
      console.error("File upload error:", error);
      setUploadStatus("ファイルの読み込みに失敗しました");
    }

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 抽出済みかどうかをチェック
  const hasExtractedData = inputFields.some((f) => f.value.trim() !== "");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-xl flex items-center justify-center text-2xl">
            🎙️
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">文字起こし入力</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              会議の文字起こしテキストを入力すると、AIが議事情報を自動抽出します
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* 使い方説明 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">使い方</h3>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>会議録音の文字起こしテキストを下のテキストエリアに貼り付け、またはファイルをアップロード</li>
              <li>「AIで自動抽出」ボタンをクリックすると、議題・出席者・決定事項などを自動で抽出</li>
              <li>抽出結果を確認・修正して、議事録を生成</li>
            </ol>
          </div>

          {/* ファイルアップロード */}
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-300 dark:border-slate-600"
            >
              📁 ファイルを選択（.txt / .docx）
            </button>
            {uploadStatus && (
              <span className="text-sm text-slate-600 dark:text-slate-400">{uploadStatus}</span>
            )}
          </div>

          {/* テキストエリア */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              文字起こしテキスト
              <span className="ml-2 text-xs text-slate-400">
                {transcriptText.length.toLocaleString()}文字
              </span>
            </label>
            <textarea
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="ここに会議の文字起こしテキストを貼り付けてください...&#10;&#10;例:&#10;司会: それでは本日の会議を始めます。&#10;田中: 先月の売上について報告します...&#10;..."
              rows={15}
              className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
            />
          </div>

          {/* サンプル文字起こしバッジ */}
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">サンプル</span>
              <span className="text-xs text-green-600 dark:text-green-400">（クリックで入力）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTranscriptText(SAMPLE_TRANSCRIPT)}
                className="px-3 py-1.5 text-sm rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors border border-green-300 dark:border-green-700"
              >
                定例会議サンプル
              </button>
              <button
                onClick={() => setTranscriptText(SAMPLE_TRANSCRIPT_2)}
                className="px-3 py-1.5 text-sm rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors border border-green-300 dark:border-green-700"
              >
                プロジェクト会議サンプル
              </button>
            </div>
          </div>

          {/* 抽出ボタン */}
          <div className="flex items-center gap-4">
            <button
              onClick={extractFromTranscript}
              disabled={!transcriptText.trim() || extractStatus === "running"}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {extractStatus === "running" ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  AIで抽出中...
                </span>
              ) : (
                "🤖 AIで自動抽出"
              )}
            </button>

            {extractStatus === "completed" && (
              <span className="text-sm text-green-600 dark:text-green-400">
                ✓ 抽出完了！入力情報タブで確認してください
              </span>
            )}
            {extractStatus === "error" && (
              <span className="text-sm text-red-600 dark:text-red-400">
                ✗ 抽出に失敗しました。もう一度お試しください
              </span>
            )}
          </div>

          {/* ナビゲーション */}
          <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab("template")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              ← テンプレート
            </button>
            <button
              onClick={() => setActiveTab("input")}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              {hasExtractedData ? "入力情報を確認 →" : "入力情報へ →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// サンプル文字起こし1（定例会議）
const SAMPLE_TRANSCRIPT = `司会（山田部長）: それでは2026年1月の定例会議を始めます。本日の出席者は鈴木課長、田中主任、佐藤です。場所は本社会議室Aです。

山田部長: まず議題1、前月の進捗報告からお願いします。鈴木さん、どうぞ。

鈴木課長: はい。12月の売上実績は目標の95%でした。年末商戦の影響で一部商品の在庫が不足しましたが、おおむね順調に推移しています。

田中主任: 補足しますと、新規顧客からの問い合わせが前月比120%と増加しており、今月以降の受注につながる見込みです。

山田部長: なるほど。では次に議題2、今月の目標設定について。

佐藤: 今月は新規顧客開拓を強化したいと考えています。具体的には、展示会への出展と、Webマーケティングの強化を予定しています。

山田部長: 良いですね。展示会の予算は確保できていますか？

鈴木課長: はい、50万円の予算で申請済みです。

山田部長: 了解しました。それでは本日の決定事項をまとめます。
1つ目、来月末までに新規提案を3件以上行う。
2つ目、週次の進捗共有ミーティングを毎週月曜に実施する。
以上で本日の会議を終了します。`;

// サンプル文字起こし2（プロジェクト会議）
const SAMPLE_TRANSCRIPT_2 = `PM（木村）: オンラインミーティングを開始します。本日は1月31日、10時からのプロジェクト進捗会議です。参加者は開発チームの高橋さん、品質管理の伊藤さんです。

木村PM: まず開発の進捗状況を確認したいと思います。高橋さん、お願いします。

高橋: はい。現在、機能Aの実装が完了し、機能Bは80%まで進んでいます。ただ、テスト工程で3件のバグが発見されました。

伊藤: バグの内容を補足しますと、うち2件は軽微な表示崩れですが、1件はデータ保存に関する重要なバグです。

木村PM: 重要なバグの対応にどのくらいかかりそうですか？

高橋: 原因は特定できていて、修正自体は2日程度で完了する見込みです。

木村PM: 了解しました。では、このバグ対応を最優先でお願いします。

高橋: 承知しました。

木村PM: リリーススケジュールについてですが、当初2月末を予定していましたが、バグ対応を考慮して3月第1週に変更したいと思います。問題ありますか？

伊藤: テスト期間が確保できるので、品質面では安心です。

木村PM: では本日の決定事項です。
1. クリティカルなバグを最優先で対応する
2. リリース日を3月第1週に延期
以上です。ありがとうございました。`;
