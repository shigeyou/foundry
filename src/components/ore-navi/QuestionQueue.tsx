import type { QueueItem } from "@/lib/ore-navi-types";
import { MODE_LABELS } from "@/lib/ore-navi-presets";

interface QuestionQueueProps {
  questionQueue: QueueItem[];
  autoPlayQueue: boolean;
  setAutoPlayQueue: (value: boolean) => void;
  playingQueueIndex: number;
  isPlaying: boolean;
  onViewResult: (item: QueueItem) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function QuestionQueue({
  questionQueue,
  autoPlayQueue,
  setAutoPlayQueue,
  playingQueueIndex,
  isPlaying,
  onViewResult,
  onRemove,
  onClearCompleted,
}: QuestionQueueProps) {
  if (questionQueue.length === 0) return null;

  return (
    <div className="mb-6 w-full">
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <span>📋</span>
            質問キュー
            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">
              {questionQueue.length}
            </span>
          </h3>
          <div className="flex items-center gap-3">
            {/* 自動再生トグル */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPlayQueue}
                onChange={(e) => setAutoPlayQueue(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <span className="text-xs text-slate-400">自動再生</span>
            </label>
            {questionQueue.some(item => item.status === "completed" || item.status === "error") && (
              <button
                onClick={onClearCompleted}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                完了済みをクリア
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {questionQueue.map((item, idx) => {
            const isCurrentlyPlaying = playingQueueIndex === idx && isPlaying;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  isCurrentlyPlaying
                    ? "bg-amber-900/40 border-2 border-amber-500 shadow-lg shadow-amber-500/20"
                    : item.status === "processing"
                    ? "bg-amber-900/30 border border-amber-700"
                    : item.status === "completed"
                    ? "bg-green-900/20 border border-green-800/50 cursor-pointer hover:bg-green-900/30"
                    : item.status === "error"
                    ? "bg-red-900/20 border border-red-800/50"
                    : "bg-slate-800/50 border border-slate-700"
                }`}
                onClick={() => item.status === "completed" && onViewResult(item)}
              >
                {/* ステータスインジケーター */}
                <div className="flex-shrink-0">
                  {isCurrentlyPlaying ? (
                    <div className="flex gap-0.5" title="再生中">
                      <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
                      <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
                      <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
                    </div>
                  ) : item.status === "pending" ? (
                    <div className="w-3 h-3 rounded-full bg-slate-500" title="待機中" />
                  ) : item.status === "processing" ? (
                    <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" title="処理中" />
                  ) : item.status === "completed" ? (
                    <div className="w-3 h-3 rounded-full bg-green-500" title="完了" />
                  ) : item.status === "error" ? (
                    <div className="w-3 h-3 rounded-full bg-red-500" title="エラー" />
                  ) : null}
                </div>

                {/* 質問内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm truncate ${
                      item.status === "processing" ? "text-amber-300" :
                      item.status === "completed" ? "text-green-300" :
                      item.status === "error" ? "text-red-300" :
                      "text-slate-400"
                    }`}>
                      {item.question}
                    </p>
                    {item.mode && MODE_LABELS[item.mode] && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${MODE_LABELS[item.mode].color}`}>
                        {MODE_LABELS[item.mode].label}
                      </span>
                    )}
                  </div>
                  {item.status === "error" && item.error && (
                    <p className="text-xs text-red-400 truncate mt-0.5">{item.error}</p>
                  )}
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.status === "completed" && (
                    <span className="text-xs text-green-400 mr-1">クリックで表示</span>
                  )}
                  {(item.status === "pending" || item.status === "completed" || item.status === "error") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                      }}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                      title="削除"
                    >
                      <svg className="w-4 h-4 text-slate-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
