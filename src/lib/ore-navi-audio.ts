// 俺ナビ用グローバル音声マネージャー
// ページ遷移しても音声再生を継続させる
// 並列生成＋キュー方式：全セクションを並列生成しながら順次再生

// windowオブジェクトに保存してページ遷移時も永続化
declare global {
  interface Window {
    __oreNaviAudio?: OreNaviAudioManager;
  }
}

// セクションの生成状態
type SectionStatus = "pending" | "generating" | "ready" | "error";

type AudioState = {
  isPlaying: boolean;
  isPaused: boolean;
  currentSection: string | null;
  // キュー状態
  queueStatus: {
    total: number;
    ready: number;
    generating: number;
    pending: number;
  };
};

type StateListener = (state: AudioState) => void;

class OreNaviAudioManager {
  private audio: HTMLAudioElement | null = null;
  private audioCache: Map<string, string> = new Map();
  private sectionStatus: Map<string, SectionStatus> = new Map();
  private sectionsData: { section: string; text: string }[] = [];
  private sections: string[] = [];
  private currentIndex: number = 0;
  private stopRequested: boolean = false;
  private state: AudioState = {
    isPlaying: false,
    isPaused: false,
    currentSection: null,
    queueStatus: { total: 0, ready: 0, generating: 0, pending: 0 },
  };
  private listeners: Set<StateListener> = new Set();
  private speechSpeed: number = 140;
  private concurrencyLimit: number = 3; // 同時生成数の上限
  private generationQueue: Promise<void>[] = [];

  constructor() {
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.addEventListener("pause", () => {
        if (!this.stopRequested) {
          this.updateState({ isPlaying: false, isPaused: true });
        }
      });
      this.audio.addEventListener("play", () => {
        this.updateState({ isPlaying: true, isPaused: false });
      });
    }
  }

  private updateState(partial: Partial<AudioState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  private updateQueueStatus() {
    let ready = 0, generating = 0, pending = 0;
    for (const status of this.sectionStatus.values()) {
      if (status === "ready") ready++;
      else if (status === "generating") generating++;
      else if (status === "pending") pending++;
    }
    this.updateState({
      queueStatus: {
        total: this.sections.length,
        ready,
        generating,
        pending,
      },
    });
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): AudioState {
    return this.state;
  }

  setSpeechSpeed(speed: number) {
    this.speechSpeed = speed;
  }

  getSpeechSpeed(): number {
    return this.speechSpeed;
  }

  // 同時実行数を制限しながらタスクを実行
  private async runWithConcurrency<T>(
    tasks: (() => Promise<T>)[],
    limit: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      if (this.stopRequested) break;

      const p = task().then((result) => {
        results.push(result);
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  async generateAndPlay(
    sectionsData: { section: string; text: string }[],
    startSection?: string
  ) {
    if (!this.audio) return;

    // 既存の再生を停止
    this.stop();
    await new Promise((resolve) => setTimeout(resolve, 150));

    this.stopRequested = false;
    this.sectionsData = sectionsData;
    this.sections = sectionsData.map((s) => s.section);
    this.currentIndex = startSection
      ? this.sections.indexOf(startSection)
      : 0;
    if (this.currentIndex === -1) this.currentIndex = 0;

    // キャッシュとステータスをクリア
    this.clearCache();
    this.sectionStatus.clear();
    for (const section of this.sections) {
      this.sectionStatus.set(section, "pending");
    }
    this.updateQueueStatus();

    // 全セクションの並列生成を開始（バックグラウンド）
    this.startParallelGeneration();

    // ストリーミング再生開始
    await this.streamingPlayback();
  }

  // 全セクションを並列生成（同時実行数制限付き）
  private async startParallelGeneration() {
    const tasks = this.sectionsData.map((sectionData) => async () => {
      if (this.stopRequested) return;
      if (this.audioCache.has(sectionData.section)) return;

      this.sectionStatus.set(sectionData.section, "generating");
      this.updateQueueStatus();

      const url = await this.generateAudio(sectionData.text);

      if (url && !this.stopRequested) {
        this.audioCache.set(sectionData.section, url);
        this.sectionStatus.set(sectionData.section, "ready");
      } else {
        this.sectionStatus.set(sectionData.section, "error");
      }
      this.updateQueueStatus();
    });

    // 同時実行数を制限しながら全タスクを実行
    await this.runWithConcurrency(tasks, this.concurrencyLimit);
  }

  private async generateAudio(text: string): Promise<string | null> {
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, rate: this.speechSpeed }),
      });

      if (!res.ok) return null;

      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  private async streamingPlayback() {
    if (!this.audio) return;

    this.updateState({ isPlaying: true });

    while (this.currentIndex < this.sections.length && !this.stopRequested) {
      const section = this.sections[this.currentIndex];

      // キャッシュにあるか、生成完了まで待つ
      let url = this.audioCache.get(section);

      if (!url) {
        // 生成完了を待つ（ポーリング）
        const maxWait = 60000; // 最大60秒待機
        const pollInterval = 100;
        let waited = 0;

        while (!url && waited < maxWait && !this.stopRequested) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          url = this.audioCache.get(section);
          waited += pollInterval;
        }
      }

      if (url && !this.stopRequested) {
        this.updateState({ currentSection: section });

        // 再生完了を待つ
        const playbackComplete = await this.playAndWaitForEnd(url);

        if (!playbackComplete && this.stopRequested) {
          break;
        }
      }

      this.currentIndex++;
    }

    // 再生完了
    this.updateState({
      isPlaying: false,
      isPaused: false,
      currentSection: null,
    });
  }

  // 音声を再生し、終了まで待機する
  private async playAndWaitForEnd(url: string): Promise<boolean> {
    if (!this.audio) return false;

    return new Promise<boolean>((resolve) => {
      const audio = this.audio!;

      const cleanup = () => {
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      };

      const onEnded = () => {
        cleanup();
        resolve(true);
      };

      const onError = (err: Event) => {
        cleanup();
        console.error("Audio playback error:", err);
        resolve(false);
      };

      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);

      audio.src = url;
      audio.load();

      audio.play().catch((err) => {
        cleanup();
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Playback error:", err);
        }
        resolve(false);
      });
    });
  }

  togglePlayPause() {
    if (!this.audio) return;

    if (this.audio.paused) {
      this.audio.play().then(() => {
        this.updateState({ isPlaying: true, isPaused: false });
      }).catch(console.error);
    } else {
      this.audio.pause();
    }
  }

  isCurrentlyPaused(): boolean {
    return this.audio !== null &&
           this.audio.paused &&
           this.audio.currentTime > 0 &&
           this.sections.length > 0 &&
           !this.stopRequested;
  }

  stop() {
    this.stopRequested = true;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio.currentTime = 0;
    }
    this.updateState({
      isPlaying: false,
      isPaused: false,
      currentSection: null,
      queueStatus: { total: 0, ready: 0, generating: 0, pending: 0 },
    });
  }

  private clearCache() {
    for (const url of this.audioCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.audioCache.clear();
  }

  // 特定のセクションから再生を再開
  async playFromSection(section: string) {
    const index = this.sections.indexOf(section);
    if (index === -1) return;

    this.stopRequested = true;
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }
    await new Promise((resolve) => setTimeout(resolve, 150));

    this.stopRequested = false;
    this.currentIndex = index;
    await this.streamingPlayback();
  }

  hasCache(): boolean {
    return this.audioCache.size > 0;
  }

  // キュー状態を取得
  getQueueStatus() {
    return this.state.queueStatus;
  }

  // 特定セクションの状態を取得
  getSectionStatus(section: string): SectionStatus | undefined {
    return this.sectionStatus.get(section);
  }
}

// シングルトンインスタンスを取得（windowに保存して永続化）
export function getOreNaviAudio(): OreNaviAudioManager | null {
  if (typeof window === "undefined") return null;

  if (!window.__oreNaviAudio) {
    window.__oreNaviAudio = new OreNaviAudioManager();
    console.log("[OreNaviAudio] Created new global instance (parallel queue mode)");
  }
  return window.__oreNaviAudio;
}
