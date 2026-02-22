import type { ChatMessage } from "@/lib/ore-navi-types";

interface OreNaviChatProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  chatLoading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  sendChatMessage: (directMessage?: string) => Promise<void>;
}

export function OreNaviChat({
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  chatEndRef,
  sendChatMessage,
}: OreNaviChatProps) {
  return (
    <div className="mt-6 bg-slate-900/80 border border-slate-700 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-amber-400 font-medium flex items-center gap-2">
          <span>💬</span>
          <span>この結果について質問する</span>
        </h3>
      </div>

      {/* チャット履歴 */}
      {chatMessages.length > 0 && (
        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-amber-800/50 text-amber-100 border border-amber-700/50"
                    : "bg-slate-800 text-slate-200 border border-slate-600/50"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-lg px-4 py-2.5 text-sm border border-slate-600/50">
                <span className="animate-pulse">考え中...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* 入力エリア */}
      <div className="p-3 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
            placeholder="例：#1のインサイトをもう少し具体的に教えて"
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            disabled={chatLoading}
          />
          <button
            onClick={() => sendChatMessage()}
            disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
          >
            送信
          </button>
        </div>
        {chatMessages.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              "一番重要なインサイトはどれ？",
              "具体的に明日から何をすべき？",
              "リスクが最も高いのは？",
              "この結果を一言でまとめると？",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => sendChatMessage(suggestion)}
                className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600/50 text-slate-400 hover:text-slate-200 rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
