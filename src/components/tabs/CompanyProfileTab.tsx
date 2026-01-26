"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface CompanyProfile {
  name: string;
  shortName: string;
  description: string;
  background: string;
  techStack: string;
  parentCompany: string;
  parentRelation: string;
  industry: string;
  additionalContext: string;
}

const emptyProfile: CompanyProfile = {
  name: "",
  shortName: "",
  description: "",
  background: "",
  techStack: "",
  parentCompany: "",
  parentRelation: "",
  industry: "",
  additionalContext: "",
};

export function CompanyProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 初期読み込み
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/company-profile");
        const data = await res.json();
        if (data.profile) {
          setProfile({
            name: data.profile.name || "",
            shortName: data.profile.shortName || "",
            description: data.profile.description || "",
            background: data.profile.background || "",
            techStack: data.profile.techStack || "",
            parentCompany: data.profile.parentCompany || "",
            parentRelation: data.profile.parentRelation || "",
            industry: data.profile.industry || "",
            additionalContext: data.profile.additionalContext || "",
          });
          setIsConfigured(data.isConfigured);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  // 保存
  async function handleSave() {
    if (!profile.name.trim()) {
      setMessage({ type: "error", text: "会社名は必須です" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "保存しました" });
        setIsConfigured(true);
      } else {
        setMessage({ type: "error", text: data.error || "保存に失敗しました" });
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      setMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  // リセット
  async function handleReset() {
    if (!confirm("プロファイルをリセットしますか？")) return;

    try {
      const res = await fetch("/api/company-profile", { method: "DELETE" });
      if (res.ok) {
        setProfile(emptyProfile);
        setIsConfigured(false);
        setMessage({ type: "success", text: "リセットしました" });
      }
    } catch (error) {
      console.error("Failed to reset profile:", error);
      setMessage({ type: "error", text: "リセットに失敗しました" });
    }
  }

  const updateField = (field: keyof CompanyProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <p className="text-slate-500 dark:text-slate-400">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            対象企業設定
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            勝ち筋探索の対象となる企業の情報を設定します
          </p>
        </div>
        {isConfigured && (
          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">
            設定済み
          </span>
        )}
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 案内 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>重要：</strong> ここで設定した企業情報がAIの探索対象となります。
          RAGに親会社などの関連企業の情報を登録する場合は、「親会社との関係」欄を設定することで、
          AIが適切に区別して探索できます。
        </p>
      </div>

      {/* フォーム */}
      <div className="space-y-6">
        {/* 基本情報 */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded"></span>
            基本情報
          </h2>
          <div className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  会社名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="例: 株式会社サンプル"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  略称
                </label>
                <input
                  type="text"
                  value={profile.shortName}
                  onChange={(e) => updateField("shortName", e.target.value)}
                  placeholder="例: サンプル社"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                業界
              </label>
              <input
                type="text"
                value={profile.industry}
                onChange={(e) => updateField("industry", e.target.value)}
                placeholder="例: 製造業、IT、海運、物流など"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                会社概要
              </label>
              <textarea
                value={profile.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="例: 国内外で〇〇事業を展開する企業。従業員数約〇〇名。"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                背景・経緯
              </label>
              <textarea
                value={profile.background}
                onChange={(e) => updateField("background", e.target.value)}
                placeholder="例: 2023年にA社とB社が合併して誕生。両社の強みを活かした事業展開を目指す。"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </section>

        {/* 親会社との関係 */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-500 rounded"></span>
            親会社との関係（任意）
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            RAGに親会社の情報を登録する場合に設定してください。AIが両社を区別して探索できるようになります。
          </p>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                親会社名
              </label>
              <input
                type="text"
                value={profile.parentCompany}
                onChange={(e) => updateField("parentCompany", e.target.value)}
                placeholder="例: ホールディングス株式会社"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                関係性の説明
              </label>
              <textarea
                value={profile.parentRelation}
                onChange={(e) => updateField("parentRelation", e.target.value)}
                placeholder="例: 親会社はグループ全体を統括。当社は〇〇事業を担当する子会社として、グループの成長に貢献。"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </section>

        {/* 技術基盤・その他 */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-green-500 rounded"></span>
            技術基盤・その他（任意）
          </h2>
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                技術基盤
              </label>
              <textarea
                value={profile.techStack}
                onChange={(e) => updateField("techStack", e.target.value)}
                placeholder="例: クラウド環境はAWSを利用。自社開発チームがあり、生成AIを活用したアプリ開発を推進中。"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                その他の文脈
              </label>
              <textarea
                value={profile.additionalContext}
                onChange={(e) => updateField("additionalContext", e.target.value)}
                placeholder="例: 今期は新規事業開発に注力。DX推進が経営の重要テーマ。"
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </section>

        {/* ボタン */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isConfigured}
          >
            リセット
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
