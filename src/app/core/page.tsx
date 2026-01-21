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
import { ThemeToggle } from "@/components/theme-toggle";

interface CoreService {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  url: string | null;
}

interface RAGDocument {
  id: string;
  filename: string;
  fileType: string;
  metadata: string | null;
  createdAt: string;
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

  // RAG Document states
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [ragMessage, setRagMessage] = useState("");
  const [ragUploading, setRagUploading] = useState(false);
  const ragFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchServices();
    fetchRAGDocuments();
  }, []);

  const fetchRAGDocuments = async () => {
    try {
      const res = await fetch("/api/rag");
      const data = await res.json();
      setRagDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching RAG documents:", error);
    }
  };

  const handleRAGUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRagUploading(true);
    setRagMessage("");

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        body: uploadFormData,
      });
      const data = await res.json();
      if (data.success) {
        setRagMessage(data.message);
        fetchRAGDocuments();
      } else {
        setRagMessage("エラー: " + data.error);
      }
    } catch (error) {
      console.error("RAG upload error:", error);
      setRagMessage("アップロードに失敗しました");
    } finally {
      setRagUploading(false);
      if (ragFileInputRef.current) {
        ragFileInputRef.current.value = "";
      }
    }
  };

  const handleRAGDelete = async (id: string, filename: string) => {
    if (!confirm(`「${filename}」を削除しますか？`)) return;

    try {
      await fetch("/api/rag", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchRAGDocuments();
      setRagMessage(`${filename} を削除しました`);
    } catch (error) {
      console.error("RAG delete error:", error);
      setRagMessage("削除に失敗しました");
    }
  };

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
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 text-sm">
              ← ホームに戻る
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">コア情報</h1>
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

        {/* RAG Documents Section */}
        <Card className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-blue-800 dark:text-blue-200">
                RAGドキュメント（探索時に参照）
              </CardTitle>
              <label>
                <Button variant="outline" size="sm" disabled={ragUploading} asChild>
                  <span className="cursor-pointer">
                    {ragUploading ? "アップロード中..." : "+ ドキュメント追加"}
                  </span>
                </Button>
                <input
                  ref={ragFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.json,.docx,.csv,.pptx"
                  className="hidden"
                  onChange={handleRAGUpload}
                />
              </label>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              対応形式: PDF, TXT, MD, JSON, DOCX, CSV, PPTX
            </p>

            {ragMessage && (
              <div className="mb-3 p-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                {ragMessage}
                <button
                  className="ml-2 text-blue-900 dark:text-blue-100 font-bold"
                  onClick={() => setRagMessage("")}
                >
                  ×
                </button>
              </div>
            )}

            {ragDocuments.length === 0 ? (
              <p className="text-xs text-blue-500 dark:text-blue-400">
                ドキュメントがまだ登録されていません
              </p>
            ) : (
              <ul className="space-y-2">
                {ragDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 rounded text-blue-800 dark:text-blue-200 uppercase font-mono">
                        {doc.fileType}
                      </span>
                      <span className="truncate max-w-[200px]" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </div>
                    <button
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      onClick={() => handleRAGDelete(doc.id, doc.filename)}
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                自動参照される外部情報:
              </p>
              <ul className="space-y-1">
                <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                  <span>商船三井マリテックス（自社）</span>
                </li>
                <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                  <span>商船三井（親会社）</span>
                </li>
                <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
                  <span>MOLグループDXの取組み</span>
                  <span className="text-blue-500 dark:text-blue-400">(PDF)</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {services.length === 0 ? (
            <Card className="dark:bg-slate-800 dark:border-slate-700">
              <CardContent className="py-8 text-center text-slate-500 dark:text-slate-400">
                サービス・機能がまだ登録されていません
              </CardContent>
            </Card>
          ) : (
            services.map((service) => (
              <Card key={service.id} data-testid="service-card" className="dark:bg-slate-800 dark:border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg dark:text-slate-100">{service.name}</CardTitle>
                      {service.category && (
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded mt-1 inline-block">
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
                      <p className="text-sm text-slate-600 dark:text-slate-400">{service.description}</p>
                    )}
                    {service.url && (
                      <a
                        href={service.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
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
