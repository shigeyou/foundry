interface AudioControlsProps {
  isPlaying: boolean;
  isPaused: boolean;
  speechSpeed: number;
  setSpeechSpeed: React.Dispatch<React.SetStateAction<number>>;
  queueStatus: { total: number; ready: number; generating: number; pending: number; error: number };
  audioError: string | null;
  onGenerateSpeech: () => void;
  onTogglePlayPause: () => void;
  onStop: () => void;
}

export function AudioControls({
  isPlaying,
  isPaused,
  speechSpeed,
  setSpeechSpeed,
  queueStatus,
  audioError,
  onGenerateSpeech,
  onTogglePlayPause,
  onStop,
}: AudioControlsProps) {
  return (
    <div className="p-4 bg-slate-900/80 border border-slate-700 rounded-lg">
      <div className="flex items-center gap-4 flex-wrap">
        {/* 読み上げボタン */}
        <button
          onClick={onGenerateSpeech}
          disabled={isPlaying}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>🔊</span>
          <span>読み上げ</span>
        </button>

        {/* 再生/一時停止（再生中のみ表示） */}
        {isPlaying && (
          <>
            <button
              onClick={onTogglePlayPause}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              title={isPaused ? "再開" : "一時停止"}
            >
              {isPaused ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>
            <button
              onClick={onStop}
              className="p-2 bg-red-900/50 hover:bg-red-800/50 rounded-lg transition-colors text-red-400"
              title="停止"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z" />
              </svg>
            </button>
          </>
        )}

        {/* 速度スライダー */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-slate-400 text-sm">速度</span>
          <span className="text-slate-300 text-sm font-medium w-10">{speechSpeed}%</span>
          <button
            onClick={() => setSpeechSpeed((prev) => Math.max(50, prev - 10))}
            className="w-6 h-6 flex items-center justify-center border border-amber-500 text-amber-400 rounded hover:bg-amber-900/30 text-sm font-bold"
          >
            −
          </button>
          <input
            type="range"
            min="50"
            max="200"
            step="10"
            value={speechSpeed}
            onChange={(e) => setSpeechSpeed(Number(e.target.value))}
            className="w-24 h-1.5 cursor-pointer accent-amber-500"
          />
          <button
            onClick={() => setSpeechSpeed((prev) => Math.min(200, prev + 10))}
            className="w-6 h-6 flex items-center justify-center border border-amber-500 text-amber-400 rounded hover:bg-amber-900/30 text-sm font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* 再生中の表示とキュー状態 */}
      {isPlaying && (
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <div className="flex gap-0.5">
              <span className="w-1 h-3 bg-amber-500 rounded animate-pulse"></span>
              <span className="w-1 h-4 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.1s" }}></span>
              <span className="w-1 h-2 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.2s" }}></span>
              <span className="w-1 h-5 bg-amber-500 rounded animate-pulse" style={{ animationDelay: "0.3s" }}></span>
            </div>
            <span>再生中...</span>
          </div>
          {/* キュー状態 */}
          {queueStatus.total > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-green-400">{queueStatus.ready}</span>
              </div>
              {queueStatus.generating > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-amber-400">{queueStatus.generating}</span>
                </div>
              )}
              {queueStatus.pending > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                  <span className="text-slate-400">{queueStatus.pending}</span>
                </div>
              )}
              {queueStatus.error > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-red-400">{queueStatus.error}</span>
                </div>
              )}
              <span className="text-slate-500">/ {queueStatus.total}</span>
            </div>
          )}
        </div>
      )}

      {/* エラー表示 */}
      {audioError && (
        <div className="mt-3 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span>⚠</span>
            <span>{audioError}</span>
          </p>
        </div>
      )}
    </div>
  );
}
