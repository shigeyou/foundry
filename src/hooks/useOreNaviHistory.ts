import { useState, useCallback, useEffect } from "react";
import type { HistoryItem, OreNaviResult } from "@/lib/ore-navi-types";

interface UseOreNaviHistoryReturn {
  history: HistoryItem[];
  showHistory: boolean;
  setShowHistory: (show: boolean) => void;
  historyLoading: boolean;
  viewingHistoryId: string | null;
  fetchHistory: () => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;
  viewHistory: (item: HistoryItem) => {
    question: string;
    result: OreNaviResult;
  };
}

export function useOreNaviHistory(): UseOreNaviHistoryReturn {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/ore-navi?limit=50");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const deleteHistory = async (id: string) => {
    try {
      const res = await fetch(`/api/ore-navi?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        if (viewingHistoryId === id) {
          setViewingHistoryId(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete history:", err);
    }
  };

  const viewHistory = (item: HistoryItem) => {
    setViewingHistoryId(item.id);
    setShowHistory(false);
    return {
      question: item.question,
      result: item.result,
    };
  };

  // 履歴パネルを開いた時に履歴を取得
  useEffect(() => {
    if (showHistory && history.length === 0) {
      fetchHistory();
    }
  }, [showHistory, history.length, fetchHistory]);

  return {
    history,
    showHistory,
    setShowHistory,
    historyLoading,
    viewingHistoryId,
    fetchHistory,
    deleteHistory,
    viewHistory,
  };
}
