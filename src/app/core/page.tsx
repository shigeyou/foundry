"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface CoreService {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  url: string | null;
}

const categories = [
  "コンサルティング",
  "技術・エンジニアリング",
  "運航管理",
  "人材育成",
  "手続き・事務",
  "デジタル・IT",
  "メンテナンス",
  "その他",
];

export default function CorePage() {
  const [services, setServices] = useState<CoreService[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<CoreService | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    url: "",
  });
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/core/services");
      const data = await res.json();
      setServices(data);
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  };

  const handleSubmit = async () => {
    try {
      const method = editingService ? "PUT" : "POST";
      const body = editingService
        ? { ...formData, id: editingService.id }
        : formData;

      await fetch("/api/core/services", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setIsDialogOpen(false);
      setEditingService(null);
      setFormData({ name: "", category: "", description: "", url: "" });
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
    }
  };

  const handleEdit = (service: CoreService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category || "",
      description: service.description || "",
      url: service.url || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このサービスを削除しますか？")) return;

    try {
      await fetch(`/api/core/services?id=${id}`, { method: "DELETE" });
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
    }
  };

  const openAddDialog = () => {
    setEditingService(null);
    setFormData({ name: "", category: "", description: "", url: "" });
    setIsDialogOpen(true);
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/export?type=services&format=csv");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "services.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await fetch("/api/export?type=services&format=json");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "services.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "services");

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImportMessage(data.message);
        fetchServices();
      } else {
        setImportMessage("エラー: " + data.error);
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportMessage("インポートに失敗しました");
    }

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm">
              ← ホームに戻る
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">コア情報</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} data-testid="export-csv">
              CSVエクスポート
            </Button>
            <Button variant="outline" onClick={handleExportJSON} data-testid="export-json">
              JSONエクスポート
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span data-testid="import-btn">CSVインポート</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
                data-testid="import-input"
              />
            </label>
            <Button onClick={openAddDialog}>+ 追加</Button>
          </div>
        </div>

        {importMessage && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-lg" data-testid="import-message">
            {importMessage}
            <button
              className="ml-2 text-blue-900 font-bold"
              onClick={() => setImportMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {/* RAG Sources Info */}
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-800">
              自動参照される外部情報（RAG）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-blue-600 mb-2">
              探索時に以下の情報を自動取得してAIに渡します
            </p>
            <ul className="space-y-1">
              <li className="text-xs text-blue-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                <span>商船三井マリテックス（自社）</span>
              </li>
              <li className="text-xs text-blue-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                <span>商船三井（親会社）</span>
              </li>
              <li className="text-xs text-blue-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                <span>MOLグループDXの取組み</span>
                <span className="text-blue-500">(PDF)</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {services.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                サービス・機能がまだ登録されていません
              </CardContent>
            </Card>
          ) : (
            services.map((service) => (
              <Card key={service.id} data-testid="service-card">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      {service.category && (
                        <span className="text-xs bg-slate-200 px-2 py-1 rounded mt-1 inline-block">
                          {service.category}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(service.id)}
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {(service.description || service.url) && (
                  <CardContent>
                    {service.description && (
                      <p className="text-sm text-slate-600">{service.description}</p>
                    )}
                    {service.url && (
                      <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {service.url}
                      </a>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingService ? "サービスを編集" : "サービスを追加"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">サービス名 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="例: 港湾安全コンサルティング"
                />
              </div>
              <div className="grid gap-2">
                <Label>カテゴリ</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`px-3 py-1 text-sm rounded-full border ${
                        formData.category === cat
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                      }`}
                      onClick={() => setFormData({ ...formData, category: cat })}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="サービスの詳細説明..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
                {editingService ? "更新" : "追加"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
