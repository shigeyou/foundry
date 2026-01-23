"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

type TabType = "core" | "scores" | "appearance";

interface CoreService {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  url: string | null;
}

interface ScoreWeights {
  revenuePotential: number;
  timeToRevenue: number;
  competitiveAdvantage: number;
  executionFeasibility: number;
  hqContribution: number;
  mergerSynergy: number;
}

const defaultWeights: ScoreWeights = {
  revenuePotential: 1.0,
  timeToRevenue: 1.0,
  competitiveAdvantage: 1.0,
  executionFeasibility: 1.0,
  hqContribution: 1.0,
  mergerSynergy: 1.0,
};

const scoreLabels: Record<keyof ScoreWeights, string> = {
  revenuePotential: "収益ポテンシャル",
  timeToRevenue: "収益化までの距離",
  competitiveAdvantage: "勝ち筋の強さ",
  executionFeasibility: "実行可能性",
  hqContribution: "本社貢献",
  mergerSynergy: "合併シナジー",
};

const categories = [
  "IT基盤",
  "データサービス",
  "コンサルティング",
  "物流サービス",
  "新規事業",
  "管理機能",
  "研究開発",
  "その他",
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("core");
  const [services, setServices] = useState<CoreService[]>([]);
  const [loading, setLoading] = useState(true);

  // 新規/編集フォーム
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    url: "",
  });

  // スコア重み
  const [weights, setWeights] = useState<ScoreWeights>(defaultWeights);

  useEffect(() => {
    fetchServices();
    loadWeights();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/core/services");
      const data = await res.json();
      // APIは配列を直接返すか、{services: [...]}形式で返す
      setServices(Array.isArray(data) ? data : data.services || []);
    } catch (error) {
      console.error("Failed to fetch services:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadWeights = () => {
    const saved = localStorage.getItem("scoreWeights");
    if (saved) {
      try {
        setWeights(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  };

  const saveWeights = () => {
    localStorage.setItem("scoreWeights", JSON.stringify(weights));
    alert("スコア重みを保存しました");
  };

  const resetWeights = () => {
    setWeights(defaultWeights);
    localStorage.removeItem("scoreWeights");
    alert("スコア重みをリセットしました");
  };

  const handleAddService = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({ name: "", category: "", description: "", url: "" });
  };

  const handleEditService = (service: CoreService) => {
    setIsEditing(true);
    setEditingId(service.id);
    setFormData({
      name: service.name,
      category: service.category || "",
      description: service.description || "",
      url: service.url || "",
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ name: "", category: "", description: "", url: "" });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("名前は必須です");
      return;
    }

    try {
      const url = "/api/core/services";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...formData, id: editingId } : formData),
      });

      if (res.ok) {
        fetchServices();
        handleCancelEdit();
      } else {
        const data = await res.json();
        alert(`エラー: ${data.error}`);
      }
    } catch (error) {
      alert("保存に失敗しました");
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("このサービスを削除しますか？")) return;

    try {
      const res = await fetch(`/api/core/services?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchServices();
      }
    } catch (error) {
      alert("削除に失敗しました");
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/export?format=csv&type=core");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "core_services.csv";
      a.click();
    } catch (error) {
      alert("エクスポートに失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* ヘッダー */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
              ← ダッシュボード
            </Link>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              設定
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/strategies"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              戦略一覧
            </Link>
            <Link
              href="/insights"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              インサイト
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* タブ */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab("core")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "core"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            コア情報
          </button>
          <button
            onClick={() => setActiveTab("scores")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "scores"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            スコア設定
          </button>
          <button
            onClick={() => setActiveTab("appearance")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "appearance"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            外観
          </button>
        </div>

        {/* コア情報タブ */}
        {activeTab === "core" && (
          <div className="space-y-6">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg dark:text-slate-100">
                    コア情報（サービス・資産）
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      CSV出力
                    </Button>
                    <Button size="sm" onClick={handleAddService}>
                      + 追加
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  登録したサービス・資産は探索時に自動で参照され、より的確な戦略が生成されます。
                </p>

                {/* 追加/編集フォーム */}
                {isEditing && (
                  <div className="mb-6 p-4 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4">
                      {editingId ? "サービスを編集" : "サービスを追加"}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                          名前 *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                          カテゴリ
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setFormData({ ...formData, category: cat })}
                              className={`px-3 py-1 text-sm rounded ${
                                formData.category === cat
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                          説明
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                          URL
                        </label>
                        <input
                          type="text"
                          value={formData.url}
                          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                          className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSubmit}>保存</Button>
                        <Button variant="outline" onClick={handleCancelEdit}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* サービス一覧 */}
                {loading ? (
                  <p className="text-slate-500 dark:text-slate-400">読み込み中...</p>
                ) : services.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                    サービスが登録されていません
                  </p>
                ) : (
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="p-3 border border-slate-200 dark:border-slate-600 rounded-lg flex items-start justify-between"
                      >
                        <div>
                          <h4 className="font-medium text-slate-900 dark:text-slate-100">
                            {service.name}
                          </h4>
                          {service.category && (
                            <span className="inline-block px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded mt-1">
                              {service.category}
                            </span>
                          )}
                          {service.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditService(service)}
                            className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardContent className="py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  デフォルトSWOTは管理者のみ更新可能です。変更が必要な場合は管理者に連絡してください。
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* スコア設定タブ */}
        {activeTab === "scores" && (
          <div className="space-y-6">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg dark:text-slate-100">
                  スコア重み付け
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  各評価軸の重みを調整できます。重要度が高い項目は大きく、低い項目は小さく設定してください。
                </p>

                <div className="space-y-4">
                  {(Object.keys(weights) as (keyof ScoreWeights)[]).map((key) => (
                    <div key={key} className="flex items-center gap-4">
                      <label className="w-40 text-sm text-slate-700 dark:text-slate-300">
                        {scoreLabels[key]}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={weights[key]}
                        onChange={(e) =>
                          setWeights({ ...weights, [key]: parseFloat(e.target.value) })
                        }
                        className="flex-1"
                      />
                      <span className="w-12 text-sm text-slate-600 dark:text-slate-400 text-right">
                        {weights[key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={saveWeights}>保存</Button>
                  <Button variant="outline" onClick={resetWeights}>
                    リセット
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 外観タブ */}
        {activeTab === "appearance" && (
          <div className="space-y-6">
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg dark:text-slate-100">
                  外観設定
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-slate-100">
                      ダークモード
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      画面右上のトグルボタンで切り替えられます
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg dark:text-slate-100">
                  アプリ情報
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  <p>勝ち筋ファインダー Ver.0.5</p>
                  <p>現場の力をAIでアンプする戦略発見ツール</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
