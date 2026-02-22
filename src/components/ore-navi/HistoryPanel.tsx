import type { HistoryItem } from "@/lib/ore-navi-types";

interface HistoryPanelProps {
  history: HistoryItem[];
  historyLoading: boolean;
  viewingHistoryId: string | null;
  onClose: () => void;
  onView: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
}

export function HistoryPanel({
  history,
  historyLoading,
  viewingHistoryId,
  onClose,
  onView,
  onDelete,
}: HistoryPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📜</span>
            探索履歴
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-amber-500 border-t-transparent rounded-full" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-slate-500 text-center py-8">履歴がありません</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    viewingHistoryId === item.id
                      ? "bg-amber-900/30 border-amber-700"
                      : "bg-slate-800 border-slate-700 hover:border-slate-600"
                  }`}
                  onClick={() => onView(item)}
                >
                  <p className="text-white text-sm line-clamp-2 mb-2">
                    {item.question}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-500 text-xs">
                      {new Date(item.createdAt).toLocaleString("ja-JP", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("この履歴を削除しますか？")) {
                          onDelete(item.id);
                        }
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title="削除"
                    >
                      <svg className="w-4 h-4 text-slate-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {item.result.summary && (
                    <p className="text-amber-400/70 text-xs mt-2 line-clamp-1">
                      {item.result.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
