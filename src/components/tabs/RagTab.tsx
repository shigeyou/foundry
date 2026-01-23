"use client";

import { useState, useRef } from "react";
import { useApp, CoreService, categories } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

export function RagTab() {
  const { services, setServices, servicesLoading, fetchServices, ragDocuments, fetchRAGDocuments } =
    useApp();

  // サービス編集
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    url: "",
  });

  // RAG
  const [ragMessage, setRagMessage] = useState("");
  const [ragUploading, setRagUploading] = useState(false);
  const ragFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedRagDoc, setSelectedRagDoc] = useState<{
    filename: string;
    content: string;
    fileType: string;
  } | null>(null);
  const [ragDocLoading, setRagDocLoading] = useState(false);

  // サービス管理
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

  const handleSubmitService = async () => {
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
    if (!confirm("この事業・サービスを削除しますか？")) return;
    try {
      const res = await fetch(`/api/core/services?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchServices();
      }
    } catch (error) {
      alert("削除に失敗しました");
    }
  };

  // RAG管理
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

  const viewRAGDocument = async (id: string) => {
    setRagDocLoading(true);
    try {
      const res = await fetch(`/api/rag?id=${id}`);
      const data = await res.json();
      if (data.document) {
        setSelectedRagDoc({
          filename: data.document.filename,
          content: data.document.content,
          fileType: data.document.fileType,
        });
      }
    } catch (error) {
      console.error("RAG view error:", error);
      setRagMessage("ドキュメントの取得に失敗しました");
    } finally {
      setRagDocLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">RAG情報</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            登録した情報は探索時にAIが自動で参照し、より的確な戦略を生成します。
          </p>
        </div>
      </div>

      {/* 追加/編集フォーム */}
      {isEditing && (
        <div className="mb-6 p-6 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800">
          <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-4 text-lg">
            {editingId ? "事業・サービスを編集" : "事業・サービスを追加"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">名前 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 操船シミュレータ研修、船舶管理サービス"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
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
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">説明</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">URL</label>
              <input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmitService}>保存</Button>
              <Button variant="outline" onClick={handleCancelEdit}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 自社の事業・サービス */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              自社の事業・サービス
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">（任意）</span>
              <span className="ml-2 text-sm font-normal text-slate-400 dark:text-slate-500">
                {services.length}件
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              貴社が提供している事業やサービスを登録すると、AIがそれを前提に戦略を提案します。
            </p>
          </div>
          <Button onClick={handleAddService} size="sm">+ 事業・サービスを追加</Button>
        </div>
        {servicesLoading ? (
          <p className="text-slate-500 dark:text-slate-400">読み込み中...</p>
        ) : services.length > 0 ? (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="p-4 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 flex items-start justify-between"
              >
                <div>
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">{service.name}</h4>
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
                  {service.url && (
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 block"
                    >
                      {service.url}
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleEditService(service)}
                    className="px-2 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-500"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteService(service.id)}
                    className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 border-dashed">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              まだ登録がありません
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              未登録でも探索は可能です
            </p>
          </div>
        )}
      </div>

      {/* RAGドキュメントセクション */}
      <div className="p-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
              RAGドキュメント
            </h2>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              探索時に参照される外部ドキュメント
            </p>
          </div>
          <label>
            <span
              className={`px-4 py-2 text-sm rounded cursor-pointer ${
                ragUploading
                  ? "bg-slate-300 text-slate-500"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {ragUploading ? "アップロード中..." : "+ ドキュメント追加"}
            </span>
            <input
              ref={ragFileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.json,.docx,.csv,.pptx"
              className="hidden"
              onChange={handleRAGUpload}
              disabled={ragUploading}
            />
          </label>
        </div>

        <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">
          対応形式: PDF, TXT, MD, JSON, DOCX, CSV, PPTX
        </p>

        {ragMessage && (
          <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm flex items-center justify-between">
            <span>{ragMessage}</span>
            <button
              className="text-blue-900 dark:text-blue-100 font-bold ml-2"
              onClick={() => setRagMessage("")}
            >
              ×
            </button>
          </div>
        )}

        {ragDocuments.length === 0 ? (
          <p className="text-sm text-blue-500 dark:text-blue-400 text-center py-4">
            ドキュメントがまだ登録されていません
          </p>
        ) : (
          <ul className="space-y-2">
            {ragDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between text-sm text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 p-3 rounded"
              >
                <button
                  className="flex items-center gap-2 text-left hover:text-blue-900 dark:hover:text-blue-100"
                  onClick={() => viewRAGDocument(doc.id)}
                >
                  <span className="px-2 py-0.5 bg-blue-200 dark:bg-blue-800 rounded text-blue-800 dark:text-blue-200 uppercase font-mono text-xs">
                    {doc.fileType}
                  </span>
                  <span className="hover:underline">{doc.filename}</span>
                </button>
                <button
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2"
                  onClick={() => handleRAGDelete(doc.id, doc.filename)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
          <p className="text-blue-600 dark:text-blue-400 mb-2 font-medium" style={{ fontSize: '120%' }}>自動参照されるWebサイト情報:</p>
          <ul className="space-y-1">
            <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
              <a
                href="https://www.mol-maritex.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                商船三井マリテックス（自社）
              </a>
            </li>
            <li className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0"></span>
              <a
                href="https://www.mol.co.jp/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                商船三井
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* RAGドキュメント内容表示モーダル */}
      {selectedRagDoc && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRagDoc(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-200 dark:bg-blue-800 rounded text-blue-800 dark:text-blue-200 uppercase font-mono text-sm">
                  {selectedRagDoc.fileType}
                </span>
                <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-md">
                  {selectedRagDoc.filename}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRagDoc(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                {selectedRagDoc.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* RAGドキュメント読み込み中 */}
      {ragDocLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-xl">
            <p className="text-slate-700 dark:text-slate-300">読み込み中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
