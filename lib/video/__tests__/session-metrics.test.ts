import { describe, it, expect } from "vitest";
import {
  VideoSessionMetricsAccumulator,
  createVideoSessionMetrics,
} from "../session-metrics";

function createAccumulatorWithClock() {
  let clockMs = 1000;
  const nowFn = () => clockMs;
  const advanceClock = (ms: number) => {
    clockMs += ms;
  };
  const accumulator = new VideoSessionMetricsAccumulator(nowFn);
  return { accumulator, advanceClock, getNow: nowFn };
}

describe("VideoSessionMetricsAccumulator", () => {
  describe("chapter seek tracking", () => {
    it("records chapter seeks and counts unique chapters visited", () => {
      const { accumulator } = createAccumulatorWithClock();

      accumulator.recordChapterSeek(0);
      accumulator.recordChapterSeek(30);
      accumulator.recordChapterSeek(0);

      const metrics = accumulator.getMetrics();
      expect(metrics.chapterSeeks).toHaveLength(3);
      expect(accumulator.getChapterSeekCounts().size).toBe(2);
      expect(accumulator.getChapterSeekCounts().get(0)).toBe(2);
      expect(accumulator.getChapterSeekCounts().get(30)).toBe(1);
    });
  });

  describe("play duration tracking", () => {
    it("accumulates play time between start and stop pairs", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.recordPlayStarted();
      advanceClock(5000);
      accumulator.recordPlayStopped();

      accumulator.recordPlayStarted();
      advanceClock(3000);
      accumulator.recordPlayStopped();

      const metrics = accumulator.getMetrics();
      expect(metrics.totalPlayDurationMs).toBe(8000);
    });

    it("includes in-flight play time in getMetrics snapshot", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.recordPlayStarted();
      advanceClock(2000);

      const metrics = accumulator.getMetrics();
      expect(metrics.totalPlayDurationMs).toBe(2000);
    });

    it("guards against double recordPlayStarted", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.recordPlayStarted();
      advanceClock(3000);
      accumulator.recordPlayStarted();
      advanceClock(2000);
      accumulator.recordPlayStopped();

      const metrics = accumulator.getMetrics();
      expect(metrics.totalPlayDurationMs).toBe(5000);
    });

    it("guards against double recordPlayStopped", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.recordPlayStarted();
      advanceClock(4000);
      accumulator.recordPlayStopped();
      accumulator.recordPlayStopped();

      const metrics = accumulator.getMetrics();
      expect(metrics.totalPlayDurationMs).toBe(4000);
    });
  });

  describe("barge-in pause tracking", () => {
    it("records barge-in pauses with timestamp", () => {
      const { accumulator } = createAccumulatorWithClock();

      accumulator.recordBargeInPause(42.5);
      accumulator.recordBargeInPause(78.2);

      const metrics = accumulator.getMetrics();
      expect(metrics.bargeInPauses).toHaveLength(2);
      expect(metrics.bargeInPauses[0].pausedAtSeconds).toBe(42.5);
      expect(metrics.bargeInPauses[1].pausedAtSeconds).toBe(78.2);
    });
  });

  describe("speed change tracking", () => {
    it("records speed changes", () => {
      const { accumulator } = createAccumulatorWithClock();

      accumulator.recordSpeedChange(1.5);
      accumulator.recordSpeedChange(2);

      const metrics = accumulator.getMetrics();
      expect(metrics.speedChanges).toHaveLength(2);
      expect(metrics.speedChanges[0].speed).toBe(1.5);
      expect(metrics.speedChanges[1].speed).toBe(2);
    });
  });

  describe("overlay text tracking", () => {
    it("records overlay text entries", () => {
      const { accumulator } = createAccumulatorWithClock();

      accumulator.recordOverlayText("Key Feature: Auto-Stop");
      accumulator.recordOverlayText("Resuming demo...");

      const metrics = accumulator.getMetrics();
      expect(metrics.overlayTextsShown).toHaveLength(2);
      expect(metrics.overlayTextsShown[0].text).toBe("Key Feature: Auto-Stop");
    });
  });

  describe("video shown percentage", () => {
    it("returns 0 when videoDurationSeconds is 0", () => {
      const { accumulator } = createAccumulatorWithClock();
      expect(accumulator.getVideoShownPercentage()).toBe(0);
    });

    it("calculates percentage of video duration played", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.setVideoDurationSeconds(100);
      accumulator.recordPlayStarted();
      advanceClock(50_000);
      accumulator.recordPlayStopped();

      expect(accumulator.getVideoShownPercentage()).toBe(50);
    });

    it("caps percentage at 100", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.setVideoDurationSeconds(10);
      accumulator.recordPlayStarted();
      advanceClock(20_000);
      accumulator.recordPlayStopped();

      expect(accumulator.getVideoShownPercentage()).toBe(100);
    });
  });

  describe("toSummaryLog", () => {
    it("returns structured JSON with required fields for console.info", () => {
      const { accumulator, advanceClock } = createAccumulatorWithClock();

      accumulator.setVideoDurationSeconds(120);
      accumulator.recordChapterSeek(0);
      accumulator.recordPlayStarted();
      advanceClock(10_000);
      accumulator.recordBargeInPause(10);
      accumulator.recordPlayStopped();
      accumulator.recordSpeedChange(1.5);
      accumulator.recordOverlayText("Resuming demo...");

      const summaryLog = accumulator.toSummaryLog();
      expect(summaryLog.level).toBe("info");
      expect(summaryLog.component).toBe("video_session_metrics");
      expect(summaryLog.event).toBe("session_summary");

      const summaryPayload = summaryLog.payload as Record<string, unknown>;
      expect(summaryPayload.totalChapterSeeks).toBe(1);
      expect(summaryPayload.uniqueChaptersVisited).toBe(1);
      expect(summaryPayload.totalBargeInPauses).toBe(1);
      expect(summaryPayload.totalOverlaysShown).toBe(1);
      expect(summaryPayload.totalSpeedChanges).toBe(1);
      expect(summaryPayload.totalPlayDurationMs).toBe(10_000);
      expect(summaryPayload.videoDurationSeconds).toBe(120);
      expect(typeof summaryPayload.videoShownPercentage).toBe("number");
      expect(typeof summaryPayload.sessionDurationMs).toBe("number");
    });
  });

  describe("getMetrics returns frozen snapshot", () => {
    it("returns copies of arrays, not internal references", () => {
      const { accumulator } = createAccumulatorWithClock();
      accumulator.recordChapterSeek(0);

      const metricsSnapshot = accumulator.getMetrics();
      const originalLength = metricsSnapshot.chapterSeeks.length;

      accumulator.recordChapterSeek(30);

      expect(metricsSnapshot.chapterSeeks.length).toBe(originalLength);
    });
  });
});

describe("createVideoSessionMetrics factory", () => {
  it("returns a VideoSessionMetricsAccumulator instance", () => {
    const accumulator = createVideoSessionMetrics();
    expect(accumulator).toBeInstanceOf(VideoSessionMetricsAccumulator);
  });

  it("accepts a custom nowFn for deterministic testing", () => {
    let clockMs = 5000;
    const accumulator = createVideoSessionMetrics(() => clockMs);
    const metrics = accumulator.getMetrics();
    expect(metrics.sessionStartedAtMs).toBe(5000);
  });
});
