import { useState, useRef, useEffect } from "react";
import type { OreNaviResult, ChatMessage } from "@/lib/ore-navi-types";

interface UseOreNaviChatReturn {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  chatLoading: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  sendChatMessage: (directMessage?: string) => Promise<void>;
}

export function useOreNaviChat(
  result: OreNaviResult | null,
  question: string,
  currentMode: string | undefined
): UseOreNaviChatReturn {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendChatMessage = async (directMessage?: string) => {
    const message = directMessage || chatInput.trim();
    if (!message || chatLoading || !result) return;

    const userMessage = message;
    setChatInput("");
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: userMessage }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/ore-navi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          oreNaviContext: {
            question,
            mode: currentMode,
            summary: result.summary,
            warning: result.warning,
            insights: result.insights,
          },
        }),
      });

      if (!res.ok) throw new Error("Chat API error");
      const data = await res.json();
      setChatMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // 結果が変わったらチャットをリセット
  useEffect(() => {
    setChatMessages([]);
    setChatInput("");
  }, [result]);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    chatEndRef,
    sendChatMessage,
  };
}
