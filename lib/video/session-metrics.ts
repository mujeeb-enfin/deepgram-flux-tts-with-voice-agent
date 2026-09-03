interface ChapterSeekEntry {
  timestampSeconds: number;
  soughtAtMs: number;
}

interface BargeInPauseEntry {
  pausedAtSeconds: number;
  pausedAtMs: number;
}

interface OverlayTextEntry {
  text: string;
  shownAtMs: number;
}

interface SpeedChangeEntry {
  speed: number;
  changedAtMs: number;
}

export interface VideoSessionMetrics {
  sessionStartedAtMs: number;
  chapterSeeks: ChapterSeekEntry[];
  bargeInPauses: BargeInPauseEntry[];
  overlayTextsShown: OverlayTextEntry[];
  speedChanges: SpeedChangeEntry[];
  totalPlayDurationMs: number;
  videoDurationSeconds: number;
}

export class VideoSessionMetricsAccumulator {
  private readonly sessionStartedAtMs: number;
  private readonly chapterSeeks: ChapterSeekEntry[] = [];
  private readonly bargeInPauses: BargeInPauseEntry[] = [];
  private readonly overlayTextsShown: OverlayTextEntry[] = [];
  private readonly speedChanges: SpeedChangeEntry[] = [];
  private totalPlayDurationMs = 0;
  private videoDurationSeconds = 0;
  private playStartedAtMs: number | null = null;
  private readonly nowFn: () => number;

  constructor(nowFn: () => number = Date.now) {
    this.nowFn = nowFn;
    this.sessionStartedAtMs = this.nowFn();
  }

  setVideoDurationSeconds(durationSeconds: number): void {
    this.videoDurationSeconds = durationSeconds;
  }

  recordChapterSeek(timestampSeconds: number): void {
    this.chapterSeeks.push({
      timestampSeconds,
      soughtAtMs: this.nowFn(),
    });
  }

  recordBargeInPause(pausedAtSeconds: number): void {
    this.bargeInPauses.push({
      pausedAtSeconds,
      pausedAtMs: this.nowFn(),
    });
  }

  recordOverlayText(text: string): void {
    this.overlayTextsShown.push({
      text,
      shownAtMs: this.nowFn(),
    });
  }

  recordSpeedChange(speed: number): void {
    this.speedChanges.push({
      speed,
      changedAtMs: this.nowFn(),
    });
  }

  recordPlayStarted(): void {
    if (this.playStartedAtMs !== null) return;
    this.playStartedAtMs = this.nowFn();
  }

  recordPlayStopped(): void {
    if (this.playStartedAtMs === null) return;
    this.totalPlayDurationMs += this.nowFn() - this.playStartedAtMs;
    this.playStartedAtMs = null;
  }

  getChapterSeekCounts(): Map<number, number> {
    const chapterSeekCountMap = new Map<number, number>();
    for (const seekEntry of this.chapterSeeks) {
      const currentCount = chapterSeekCountMap.get(seekEntry.timestampSeconds) ?? 0;
      chapterSeekCountMap.set(seekEntry.timestampSeconds, currentCount + 1);
    }
    return chapterSeekCountMap;
  }

  getVideoShownPercentage(): number {
    if (this.videoDurationSeconds <= 0) return 0;
    const videoDurationMs = this.videoDurationSeconds * 1000;
    return Math.min(100, (this.totalPlayDurationMs / videoDurationMs) * 100);
  }

  getMetrics(): VideoSessionMetrics {
    let resolvedPlayDuration = this.totalPlayDurationMs;
    if (this.playStartedAtMs !== null) {
      resolvedPlayDuration += this.nowFn() - this.playStartedAtMs;
    }
    return {
      sessionStartedAtMs: this.sessionStartedAtMs,
      chapterSeeks: [...this.chapterSeeks],
      bargeInPauses: [...this.bargeInPauses],
      overlayTextsShown: [...this.overlayTextsShown],
      speedChanges: [...this.speedChanges],
      totalPlayDurationMs: resolvedPlayDuration,
      videoDurationSeconds: this.videoDurationSeconds,
    };
  }

  toSummaryLog(): Record<string, unknown> {
    const metrics = this.getMetrics();
    return {
      level: "info",
      component: "video_session_metrics",
      event: "session_summary",
      payload: {
        sessionDurationMs: this.nowFn() - this.sessionStartedAtMs,
        totalChapterSeeks: metrics.chapterSeeks.length,
        uniqueChaptersVisited: this.getChapterSeekCounts().size,
        totalBargeInPauses: metrics.bargeInPauses.length,
        totalOverlaysShown: metrics.overlayTextsShown.length,
        totalSpeedChanges: metrics.speedChanges.length,
        totalPlayDurationMs: metrics.totalPlayDurationMs,
        videoDurationSeconds: metrics.videoDurationSeconds,
        videoShownPercentage: Math.round(this.getVideoShownPercentage() * 10) / 10,
      },
    };
  }
}

export function createVideoSessionMetrics(
  nowFn?: () => number
): VideoSessionMetricsAccumulator {
  return new VideoSessionMetricsAccumulator(nowFn);
}
