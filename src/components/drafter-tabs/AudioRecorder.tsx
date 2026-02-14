"use client";

import { useState, useRef, useCallback } from "react";

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onRecordingComplete, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const file = new File([blob], `recording-${timestamp}.webm`, { type: "audio/webm" });
        onRecordingComplete(file);

        // ストリームを停止
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // 1秒ごとにデータ取得
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("マイクへのアクセスに失敗:", err);
      alert("マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3">
      {isRecording ? (
        <>
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <span className="w-3 h-3 bg-white rounded-sm" />
            録音停止
          </button>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-mono">{formatDuration(duration)}</span>
            <span className="text-xs text-slate-500">録音中...</span>
          </div>
        </>
      ) : (
        <button
          onClick={startRecording}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          マイクで録音
        </button>
      )}
    </div>
  );
}
