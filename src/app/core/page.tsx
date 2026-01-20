"use client";

import { useState, useEffect } from "react";
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
          <Button onClick={openAddDialog}>+ 追加</Button>
        </div>

        <div className="grid gap-4">
          {services.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-500">
                サービス・機能がまだ登録されていません
              </CardContent>
            </Card>
          ) : (
            services.map((service) => (
              <Card key={service.id}>
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
