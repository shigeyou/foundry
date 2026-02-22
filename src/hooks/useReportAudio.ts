import { useState, useEffect, useCallback, useRef } from "react";
import { getOreNaviAudio } from "@/lib/ore-navi-audio";

interface QueueStatus {
  total: number;
  ready: number;
  generating: number;
  pending: number;
  error: number;
}

interface UseReportAudioReturn {
  speechSpeed: number;
  setSpeechSpeed: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isPaused: boolean;
  currentSection: string | null;
  queueStatus: QueueStatus;
  audioError: string | null;
  playSections: (sections: { section: string; text: string }[]) => Promise<void>;
  togglePlayPause: () => void;
  stopSpeech: () => void;
  playFromSection: (section: string) => void;
}

export function useReportAudio(): UseReportAudioReturn {
  const [speechSpeed, setSpeechSpeed] = useState(140);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ total: 0, ready: 0, generating: 0, pending: 0, error: 0 });
  const [audioError, setAudioError] = useState<string | null>(null);
  const lastSectionsRef = useRef<{ section: string; text: string }[]>([]);

  // グローバル音声マネージャーの状態を購読
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;

    const unsubscribe = audioManager.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
      setCurrentSection(state.currentSection);
      setQueueStatus(state.queueStatus);
      setAudioError(state.error);
    });

    audioManager.setSpeechSpeed(speechSpeed);
    return unsubscribe;
  }, [speechSpeed]);

  // speechSpeed変更時にマネージャーに通知
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (audioManager) {
      audioManager.setSpeechSpeed(speechSpeed);
    }
  }, [speechSpeed]);

  // セクションデータで再生開始
  const playSections = useCallback(async (sections: { section: string; text: string }[]) => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;

    if (isPlaying) return;

    // 一時停止状態なら再開
    if (audioManager.isCurrentlyPaused()) {
      audioManager.togglePlayPause();
      return;
    }

    lastSectionsRef.current = sections;
    const filtered = sections.filter(s => s.text.trim());
    await audioManager.generateAndPlay(filtered);
  }, [isPlaying]);

  const togglePlayPause = useCallback(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.togglePlayPause();
  }, []);

  const stopSpeech = useCallback(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.stop();
    setCurrentSection(null);
  }, []);

  const playFromSection = useCallback((section: string) => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.playFromSection(section);
  }, []);

  return {
    speechSpeed,
    setSpeechSpeed,
    isPlaying,
    isPaused,
    currentSection,
    queueStatus,
    audioError,
    playSections,
    togglePlayPause,
    stopSpeech,
    playFromSection,
  };
}
