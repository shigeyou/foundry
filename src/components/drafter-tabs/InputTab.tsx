"use client";

import { useEffect, useState } from "react";
import { useDrafter, InputField } from "@/contexts/DrafterContext";
import { FileDropzone } from "@/components/ui/file-dropzone";

// サンプルデータ
interface SampleData {
  label: string;
  data: Record<string, string>;
}

const sampleDataByTemplate: Record<string, SampleData[]> = {
  "minutes": [
    {
      label: "定例会議",
      data: {
        meeting_date: "2026年1月31日 14:00〜15:30",
        meeting_place: "本社会議室A",
        attendees: "山田部長、鈴木課長、田中主任、佐藤",
        agenda: "1. 前月の進捗報告\n2. 今月の目標設定\n3. 課題と対策の検討",
        discussion: "・売上目標の達成率について議論\n・新規顧客開拓の施策を検討\n・人員配置の見直しを提案",
        decisions: "・来月末までに新規提案3件を目標とする\n・週次の進捗共有を実施する",
      },
    },
    {
      label: "プロジェクト会議",
      data: {
        meeting_date: "2026年1月31日 10:00〜11:00",
        meeting_place: "オンライン（Teams）",
        attendees: "プロジェクトマネージャー、開発チーム、品質管理担当",
        agenda: "1. 開発進捗の確認\n2. 課題の共有\n3. リリーススケジュールの確認",
        discussion: "・テスト工程で発見されたバグの対応方針\n・リソース不足の懸念",
        decisions: "・クリティカルなバグを優先対応\n・リリース日を1週間延期",
      },
    },
  ],
  "approval-document": [
    {
      label: "システム導入",
      data: {
        title: "営業支援システム導入の件",
        department: "営業企画部",
        reason: "現在の営業活動は紙ベースの管理が中心であり、情報共有の遅延や重複対応が発生しています。営業支援システムの導入により、業務効率化と売上向上を図ります。",
        content: "クラウド型営業支援システム「SalesForce」を導入し、全営業担当者（50名）に展開します。\n\n【導入範囲】\n・顧客管理機能\n・商談管理機能\n・レポート機能",
        budget: "初期費用500万円、月額利用料50万円",
        schedule: "2026年4月〜導入準備、2026年7月〜本番稼働",
      },
    },
    {
      label: "備品購入",
      data: {
        title: "ノートPC追加購入の件",
        department: "総務部",
        reason: "新規採用者の増加に伴い、業務用ノートPCが不足しています。円滑な業務遂行のため、追加購入を申請します。",
        content: "業務用ノートPC 10台を購入します。\n\n【仕様】\n・CPU: Intel Core i5以上\n・メモリ: 16GB以上\n・SSD: 256GB以上",
        budget: "150万円（1台15万円×10台）",
        schedule: "承認後2週間以内に納品予定",
      },
    },
  ],
  "proposal": [
    {
      label: "DX推進提案",
      data: {
        client: "株式会社サンプル商事",
        project_name: "業務DX推進プロジェクト",
        background: "貴社では紙文書の管理や手作業での集計業務が多く、業務効率化が課題となっています。また、リモートワーク対応も急務となっており、デジタル化の推進が求められています。",
        proposal_content: "文書管理システムの導入とRPAによる定型業務の自動化を提案します。\n\n【提案内容】\n1. クラウド文書管理システムの導入\n2. 月次集計業務のRPA化\n3. 電子承認ワークフローの構築",
        expected_effect: "・文書検索時間 80%削減\n・集計業務 90%削減\n・ペーパーレス化による年間100万円のコスト削減",
        budget_range: "初期費用 300〜500万円、月額運用費 10〜20万円",
      },
    },
    {
      label: "研修プログラム",
      data: {
        client: "ABCホールディングス株式会社",
        project_name: "管理職向けリーダーシップ研修",
        background: "貴社では若手管理職の育成が急務となっており、マネジメントスキルの強化が求められています。特にリモート環境でのチームマネジメントに課題を感じているとのことです。",
        proposal_content: "3ヶ月間の管理職向けリーダーシップ研修プログラムを提案します。\n\n【プログラム構成】\n・月1回の集合研修（3時間×3回）\n・週1回のオンラインコーチング\n・実践課題とフィードバック",
        expected_effect: "・部下とのコミュニケーション改善\n・チーム生産性の向上\n・離職率の低減",
        budget_range: "参加者1名あたり 30〜50万円",
      },
    },
  ],
};

export function InputTab() {
  const { setActiveTab, drafterId, inputFields, setInputFields, updateInputField } = useDrafter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // ファイルからテキストを読み込む
  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
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
        setUploadError(result.error || "ファイルの読み込みに失敗しました");
        return;
      }

      // 議事録ドラフターの場合、内容を「討議内容（メモ）」に入力
      if (drafterId === "minutes") {
        updateInputField("discussion", result.content);
      } else {
        // その他のテンプレートでは、最初のtextareaフィールドに入力
        const textareaField = inputFields.find((f) => f.type === "textarea");
        if (textareaField) {
          updateInputField(textareaField.id, result.content);
        }
      }

      setUploadedFileName(file.name);
    } catch (error) {
      console.error("File upload error:", error);
      setUploadError("ファイルの読み込み中にエラーが発生しました");
    } finally {
      setIsUploading(false);
    }
  };

  // サンプルデータを適用
  const applySample = (sample: SampleData) => {
    const newFields = inputFields.map((field) => ({
      ...field,
      value: sample.data[field.id] || field.value,
    }));
    setInputFields(newFields);
  };

  // 現在のテンプレートのサンプル一覧
  const currentSamples = sampleDataByTemplate[drafterId || ""] || [];

  // テンプレートに応じた入力フィールドを設定
  useEffect(() => {
    const fieldsByTemplate: Record<string, InputField[]> = {
      "minutes": [
        { id: "meeting_date", label: "会議日時", type: "text", value: "", required: true },
        { id: "meeting_place", label: "場所", type: "text", value: "", required: true },
        { id: "attendees", label: "出席者", type: "textarea", value: "", required: true },
        { id: "agenda", label: "議題", type: "textarea", value: "", required: true },
        { id: "discussion", label: "討議内容（メモ）", type: "textarea", value: "", required: false },
        { id: "decisions", label: "決定事項", type: "textarea", value: "", required: false },
      ],
      "approval-document": [
        { id: "title", label: "件名", type: "text", value: "", required: true },
        { id: "department", label: "起案部署", type: "text", value: "", required: true },
        { id: "reason", label: "起案理由", type: "textarea", value: "", required: true },
        { id: "content", label: "内容詳細", type: "textarea", value: "", required: true },
        { id: "budget", label: "予算", type: "text", value: "", required: false },
        { id: "schedule", label: "スケジュール", type: "text", value: "", required: false },
      ],
      "proposal": [
        { id: "client", label: "提案先", type: "text", value: "", required: true },
        { id: "project_name", label: "プロジェクト名", type: "text", value: "", required: true },
        { id: "background", label: "背景・課題", type: "textarea", value: "", required: true },
        { id: "proposal_content", label: "提案概要", type: "textarea", value: "", required: true },
        { id: "expected_effect", label: "期待効果", type: "textarea", value: "", required: false },
        { id: "budget_range", label: "概算費用", type: "text", value: "", required: false },
      ],
    };

    const fields = fieldsByTemplate[drafterId || ""] || [
      { id: "content", label: "内容", type: "textarea", value: "", required: true },
    ];

    if (inputFields.length === 0) {
      setInputFields(fields);
    }
  }, [drafterId, inputFields.length, setInputFields]);

  const requiredFieldsFilled = inputFields
    .filter((f) => f.required)
    .every((f) => f.value.trim() !== "");

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">入力情報</h2>

        {/* ファイル読み込み */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">ファイルから読み込み</span>
            <span className="text-xs text-blue-600 dark:text-blue-400">（PDF, DOCX, MD, TXT, JSON）</span>
          </div>
          <FileDropzone
            accept=".pdf,.docx,.md,.txt,.json"
            onFilesSelected={handleFileUpload}
            uploading={isUploading}
            label="ファイルをドラッグ＆ドロップ、またはクリックして選択"
            helperText="対応形式: PDF, Word (DOCX), Markdown, テキスト, JSON"
            compact
          />
          {uploadError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          )}
          {uploadedFileName && !uploadError && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              「{uploadedFileName}」を読み込みました
            </p>
          )}
        </div>

        {/* サンプルバッジ */}
        {currentSamples.length > 0 && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-green-800 dark:text-green-200">サンプルで入力</span>
              <span className="text-xs text-green-600 dark:text-green-400">（クリックするとサンプルデータが入力されます）</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentSamples.map((sample, i) => (
                <button
                  key={i}
                  onClick={() => applySample(sample)}
                  className="px-3 py-1.5 text-sm rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 transition-colors border border-green-300 dark:border-green-700"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {inputFields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  value={field.value}
                  onChange={(e) => updateInputField(field.id, e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={`${field.label}を入力...`}
                />
              ) : (
                <input
                  type={field.type}
                  value={field.value}
                  onChange={(e) => updateInputField(field.id, e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={`${field.label}を入力...`}
                />
              )}
            </div>
          ))}

          {!requiredFieldsFilled && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ※ 必須項目（*）をすべて入力してください
            </p>
          )}

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setActiveTab("template")}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              ← テンプレート
            </button>
            <button
              onClick={() => setActiveTab("generate")}
              disabled={!requiredFieldsFilled}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              下書き生成へ →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
