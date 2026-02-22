import { useState, useEffect, useCallback } from "react";
import { getOreNaviAudio } from "@/lib/ore-navi-audio";
import type { OreNaviResult, SectionType } from "@/lib/ore-navi-types";

interface QueueStatus {
  total: number;
  ready: number;
  generating: number;
  pending: number;
  error: number;
}

interface UseOreNaviAudioReturn {
  speechSpeed: number;
  setSpeechSpeed: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  isPaused: boolean;
  audioCurrentSection: string | null;
  queueStatus: QueueStatus;
  currentSection: SectionType | null;
  audioError: string | null;
  generateSpeech: () => Promise<void>;
  playSectionsFrom: (startSection: SectionType) => Promise<void>;
  handleSectionClick: (section: SectionType) => void;
  togglePlayPause: () => void;
  stopSpeech: () => void;
  getSectionText: (res: OreNaviResult, section: SectionType) => string;
  getInsightIndexFromSection: (section: SectionType) => number | null;
  getSections: (res: OreNaviResult) => SectionType[];
}

export function useOreNaviAudio(
  result: OreNaviResult | null,
  setExpandedInsight: (id: string | null) => void
): UseOreNaviAudioReturn {
  const [speechSpeed, setSpeechSpeed] = useState(140);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioCurrentSection, setAudioCurrentSection] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ total: 0, ready: 0, generating: 0, pending: 0, error: 0 });
  const [currentSection, setCurrentSection] = useState<SectionType | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // セクションごとのテキストを取得
  const getSectionText = useCallback((res: OreNaviResult, section: SectionType): string => {
    if (section === "summary") {
      return res.summary;
    }
    if (section === "warning") {
      return "警告: " + res.warning;
    }

    const subMatch = section.match(/^insight-(\d+)-(\w+)$/);
    if (subMatch) {
      const index = parseInt(subMatch[1], 10);
      const subSection = subMatch[2];
      const insight = res.insights[index];
      if (insight) {
        switch (subSection) {
          case "title":
            return `${index + 1}つ目。${insight.title}`;
          case "content":
            return insight.content;
          case "why_now":
            return "なぜ今か。" + insight.why_now;
          case "why_you":
            return "なぜあなたか。" + insight.why_you;
          case "action":
            return "次の一手。" + insight.action;
          case "risk":
            return insight.risk ? "注意点。" + insight.risk : "";
        }
      }
    }
    return "";
  }, []);

  // セクションからインサイトインデックスを取得
  const getInsightIndexFromSection = useCallback((section: SectionType): number | null => {
    const match = section.match(/^insight-(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }, []);

  // セクションリストを取得
  const getSections = useCallback((res: OreNaviResult): SectionType[] => {
    const sections: SectionType[] = ["summary"];
    if (res.warning) {
      sections.push("warning");
    }
    res.insights.forEach((insight, i) => {
      sections.push(`insight-${i}-title`);
      sections.push(`insight-${i}-content`);
      sections.push(`insight-${i}-why_now`);
      sections.push(`insight-${i}-why_you`);
      sections.push(`insight-${i}-action`);
      if (insight.risk) {
        sections.push(`insight-${i}-risk`);
      }
    });
    return sections;
  }, []);

  // グローバル音声マネージャーの状態を購読
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;

    const unsubscribe = audioManager.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setIsPaused(state.isPaused);
      setAudioCurrentSection(state.currentSection);
      setQueueStatus(state.queueStatus);
      setAudioError(state.error);

      if (state.currentSection) {
        setCurrentSection(state.currentSection);
        const match = state.currentSection.match(/^insight-(\d+)/);
        if (match && result) {
          const insightIndex = parseInt(match[1], 10);
          const insight = result.insights[insightIndex];
          if (insight) {
            setExpandedInsight(insight.id);
          }
        } else {
          setExpandedInsight(null);
        }
      } else if (!state.isPlaying) {
        setCurrentSection(null);
      }
    });

    audioManager.setSpeechSpeed(speechSpeed);

    return unsubscribe;
  }, [result, speechSpeed, setExpandedInsight]);

  // speechSpeedが変更されたらマネージャーに通知
  useEffect(() => {
    const audioManager = getOreNaviAudio();
    if (audioManager) {
      audioManager.setSpeechSpeed(speechSpeed);
    }
  }, [speechSpeed]);

  // 全セクションを順番に再生
  const generateSpeech = useCallback(async () => {
    const audioManager = getOreNaviAudio();
    if (!result || !audioManager) return;

    if (isPlaying) return;

    if (audioManager.isCurrentlyPaused()) {
      audioManager.togglePlayPause();
      return;
    }

    const sections = getSections(result);
    const sectionsData = sections
      .map((section) => ({
        section,
        text: getSectionText(result, section),
      }))
      .filter((s) => s.text.trim());

    await audioManager.generateAndPlay(sectionsData);
  }, [result, isPlaying, getSections, getSectionText]);

  // 指定セクションから再生を開始
  const playSectionsFrom = useCallback(async (startSection: SectionType) => {
    const audioManager = getOreNaviAudio();
    if (!result || !audioManager) return;

    if (audioManager.hasCache()) {
      await audioManager.playFromSection(startSection);
    } else {
      const sections = getSections(result);
      const sectionsData = sections
        .map((section) => ({
          section,
          text: getSectionText(result, section),
        }))
        .filter((s) => s.text.trim());

      await audioManager.generateAndPlay(sectionsData, startSection);
    }
  }, [result, getSections, getSectionText]);

  // セクションをクリックしてそこから読み上げ開始
  const handleSectionClick = useCallback((section: SectionType) => {
    if (isPlaying) {
      playSectionsFrom(section);
    }
  }, [isPlaying, playSectionsFrom]);

  // 再生/一時停止
  const togglePlayPause = useCallback(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.togglePlayPause();
  }, []);

  // 停止
  const stopSpeech = useCallback(() => {
    const audioManager = getOreNaviAudio();
    if (!audioManager) return;
    audioManager.stop();
    setCurrentSection(null);
    setExpandedInsight(null);
  }, [setExpandedInsight]);

  return {
    speechSpeed,
    setSpeechSpeed,
    isPlaying,
    isPaused,
    audioCurrentSection,
    queueStatus,
    currentSection,
    audioError,
    generateSpeech,
    playSectionsFrom,
    handleSectionClick,
    togglePlayPause,
    stopSpeech,
    getSectionText,
    getInsightIndexFromSection,
    getSections,
  };
}
