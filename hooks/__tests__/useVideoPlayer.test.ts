import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dispatchVideoFunctionCall,
  resetVideoElement,
  pauseVideoElementOnBargeIn,
  INITIAL_VIDEO_PLAYER_STATE,
  ALLOWED_PLAYBACK_SPEEDS,
  DEFAULT_OVERLAY_DURATION_SECONDS,
  RESUME_CONFIRMATION_TEXT,
  RESUME_CONFIRMATION_DURATION_MS,
  type VideoPlayerState,
  type VideoFunctionCallbacks,
} from "../useVideoPlayer.handlers";

function createMockVideoElement(
  overrides?: Partial<HTMLVideoElement>
): HTMLVideoElement {
  return {
    currentTime: 0,
    duration: 300,
    paused: true,
    playbackRate: 1,
    muted: true,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    ...overrides,
  } as unknown as HTMLVideoElement;
}

function createMockCallbacks(): VideoFunctionCallbacks & {
  capturedStateUpdates: Array<(prev: VideoPlayerState) => VideoPlayerState>;
  capturedTimers: Array<ReturnType<typeof setTimeout>>;
} {
  const capturedStateUpdates: Array<
    (prev: VideoPlayerState) => VideoPlayerState
  > = [];
  const capturedTimers: Array<ReturnType<typeof setTimeout>> = [];
  return {
    setVideoPlayerState: vi.fn((updater) => {
      capturedStateUpdates.push(updater);
    }),
    clearOverlayTimer: vi.fn(),
    setOverlayTimer: vi.fn((timer) => {
      capturedTimers.push(timer);
    }),
    capturedStateUpdates,
    capturedTimers,
  };
}

function applyStateUpdate(
  callbacks: ReturnType<typeof createMockCallbacks>,
  base: VideoPlayerState = INITIAL_VIDEO_PLAYER_STATE
): VideoPlayerState {
  let currentState = base;
  for (const updater of callbacks.capturedStateUpdates) {
    currentState = updater(currentState);
  }
  return currentState;
}

describe("dispatchVideoFunctionCall", () => {
  let mockVideoElement: HTMLVideoElement;
  let mockCallbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockVideoElement = createMockVideoElement();
    mockCallbacks = createMockCallbacks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /*  seek_and_play                                                      */
  /* ------------------------------------------------------------------ */
  describe("seek_and_play", () => {
    it("sets currentTime and calls play() at the target timestamp", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 45}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.currentTime).toBe(45);
      expect(mockVideoElement.play).toHaveBeenCalledOnce();
      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.isVideoPlaying).toBe(true);
      expect(videoFunctionResult).toContain("45 seconds");
    });

    it("clamps timestamp to video duration to prevent out-of-bounds seek", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 999}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.currentTime).toBe(300);
      expect(videoFunctionResult).toContain("300 seconds");
    });

    it("rejects NaN timestamp with error message and structured log", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": "hello"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Invalid timestamp");
      expect(mockVideoElement.play).not.toHaveBeenCalled();
      expect(mockCallbacks.setVideoPlayerState).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const parsedLogEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(parsedLogEntry.event).toBe("video_seek_invalid_timestamp");
      expect(parsedLogEntry.component).toBe("use_video_player");
      consoleWarnSpy.mockRestore();
    });

    it("rejects negative timestamp with structured log", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": -10}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Invalid timestamp");
      expect(mockVideoElement.play).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      consoleWarnSpy.mockRestore();
    });

    it("accepts timestamp zero as valid seek-to-start", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 0}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.currentTime).toBe(0);
      expect(mockVideoElement.play).toHaveBeenCalledOnce();
    });

    it("uses target timestamp when duration is NaN (not yet loaded)", () => {
      const unloadedVideoElement = createMockVideoElement({ duration: NaN } as unknown as Partial<HTMLVideoElement>);
      dispatchVideoFunctionCall(
        unloadedVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 45}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(unloadedVideoElement.currentTime).toBe(45);
    });

    it("returns user-readable confirmation string", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 72}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toMatch(/Video is now playing from 72 seconds/);
    });

    it("resets isVideoEnded to false when seeking to a new position", () => {
      const endedBaseState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        isVideoEnded: true,
        isVideoPlaying: false,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 10}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks, endedBaseState);
      expect(updatedState.isVideoEnded).toBe(false);
      expect(updatedState.isVideoPlaying).toBe(true);
    });

    it("reverts isVideoPlaying to false when play() promise rejects", async () => {
      const rejectingVideoElement = createMockVideoElement({
        play: vi.fn().mockRejectedValue(new DOMException("NotAllowedError")),
      } as unknown as Partial<HTMLVideoElement>);

      dispatchVideoFunctionCall(
        rejectingVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 10}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await vi.runAllTimersAsync();

      const finalState = applyStateUpdate(mockCallbacks);
      expect(finalState.isVideoPlaying).toBe(false);
      consoleWarnSpy.mockRestore();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  pause_video                                                        */
  /* ------------------------------------------------------------------ */
  describe("pause_video", () => {
    it("calls pause() and sets isVideoPlaying to false", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "pause_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.pause).toHaveBeenCalledOnce();
      const updatedState = applyStateUpdate(mockCallbacks, {
        ...INITIAL_VIDEO_PLAYER_STATE,
        isVideoPlaying: true,
      });
      expect(updatedState.isVideoPlaying).toBe(false);
    });

    it("includes currentTime in return string", () => {
      const playingElement = createMockVideoElement({ currentTime: 42.7 } as Partial<HTMLVideoElement>);
      const videoFunctionResult = dispatchVideoFunctionCall(
        playingElement,
        "pause_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("43 seconds");
    });

    it("does not call play()", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "pause_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.play).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  resume_video                                                       */
  /* ------------------------------------------------------------------ */
  describe("resume_video", () => {
    it("calls play() and sets isVideoPlaying to true", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockVideoElement.play).toHaveBeenCalledOnce();
      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.isVideoPlaying).toBe(true);
    });

    it("does not modify currentTime", () => {
      const pausedAtElement = createMockVideoElement({ currentTime: 42 } as Partial<HTMLVideoElement>);
      dispatchVideoFunctionCall(
        pausedAtElement,
        "resume_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(pausedAtElement.currentTime).toBe(42);
    });

    it("resets isVideoEnded to false when resuming after video ended", () => {
      const endedBaseState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        isVideoEnded: true,
        isVideoPlaying: false,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks, endedBaseState);
      expect(updatedState.isVideoEnded).toBe(false);
      expect(updatedState.isVideoPlaying).toBe(true);
    });

    it("reverts isVideoPlaying to false when resume play() rejects", async () => {
      const rejectingVideoElement = createMockVideoElement({
        play: vi.fn().mockRejectedValue(new DOMException("NotAllowedError")),
      } as unknown as Partial<HTMLVideoElement>);

      dispatchVideoFunctionCall(
        rejectingVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await vi.runAllTimersAsync();

      const finalState = applyStateUpdate(mockCallbacks);
      expect(finalState.isVideoPlaying).toBe(false);
      consoleWarnSpy.mockRestore();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  set_playback_speed                                                 */
  /* ------------------------------------------------------------------ */
  describe("set_playback_speed", () => {
    it.each(ALLOWED_PLAYBACK_SPEEDS)(
      "accepts allowed speed %s and sets playbackRate",
      (allowedSpeed) => {
        dispatchVideoFunctionCall(
          mockVideoElement,
          "set_playback_speed",
          JSON.stringify({ speed: allowedSpeed }),
          mockCallbacks,
          INITIAL_VIDEO_PLAYER_STATE
        );

        expect(mockVideoElement.playbackRate).toBe(allowedSpeed);
        const updatedState = applyStateUpdate(mockCallbacks);
        expect(updatedState.videoPlaybackSpeed).toBe(allowedSpeed);
      }
    );

    it("rejects speed=3 with error message, allowed values, and structured log", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "set_playback_speed",
        '{"speed": 3}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Invalid speed");
      expect(videoFunctionResult).toContain("0.5, 1, 1.5, 2");
      expect(mockVideoElement.playbackRate).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const parsedLogEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(parsedLogEntry.event).toBe("video_speed_invalid");
      expect(parsedLogEntry.component).toBe("use_video_player");
      consoleWarnSpy.mockRestore();
    });

    it("rejects speed=0 with structured log", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "set_playback_speed",
        '{"speed": 0}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Invalid speed");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      consoleWarnSpy.mockRestore();
    });

    it("rejects non-numeric speed with structured log", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "set_playback_speed",
        '{"speed": "fast"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Invalid speed");
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      consoleWarnSpy.mockRestore();
    });

    it("return message includes the speed value", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "set_playback_speed",
        '{"speed": 1.5}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("1.5x");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  show_overlay_text                                                  */
  /* ------------------------------------------------------------------ */
  describe("show_overlay_text", () => {
    it("sets overlay text in state", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "Key Feature: Auto-Stop"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe("Key Feature: Auto-Stop");
    });

    it("uses default 5-second duration when not specified", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "hello"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockCallbacks.setOverlayTimer).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(DEFAULT_OVERLAY_DURATION_SECONDS * 1000);

      const clearCall = mockCallbacks.capturedStateUpdates.at(-1);
      expect(clearCall).toBeDefined();
      const clearedState = clearCall!({
        ...INITIAL_VIDEO_PLAYER_STATE,
        videoOverlayText: "hello",
      });
      expect(clearedState.videoOverlayText).toBe("");
    });

    it("uses custom duration when specified", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "hello", "duration_seconds": 10}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      vi.advanceTimersByTime(9999);
      expect(mockCallbacks.capturedStateUpdates).toHaveLength(1);

      vi.advanceTimersByTime(1);
      expect(mockCallbacks.capturedStateUpdates).toHaveLength(2);

      const clearUpdater = mockCallbacks.capturedStateUpdates[1];
      const clearedState = clearUpdater({
        ...INITIAL_VIDEO_PLAYER_STATE,
        videoOverlayText: "hello",
      });
      expect(clearedState.videoOverlayText).toBe("");
    });

    it("clears previous overlay timer before setting new one", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "first"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );
      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "second"}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockCallbacks.clearOverlayTimer).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.setOverlayTimer).toHaveBeenCalledTimes(2);
    });

    it("handles empty text string without crashing", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": ""}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe("");
      expect(videoFunctionResult).toContain("Showing overlay text");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Resume confirmation overlay after barge-in                        */
  /* ------------------------------------------------------------------ */
  describe("resume confirmation overlay after barge-in", () => {
    it("shows resume overlay when seek_and_play is called after barge-in", () => {
      const bargeInState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        wasPausedByBargeIn: true,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 30}',
        mockCallbacks,
        bargeInState
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe(RESUME_CONFIRMATION_TEXT);
      expect(updatedState.wasPausedByBargeIn).toBe(false);
      expect(mockCallbacks.clearOverlayTimer).toHaveBeenCalled();
      expect(mockCallbacks.setOverlayTimer).toHaveBeenCalled();
    });

    it("shows resume overlay when resume_video is called after barge-in", () => {
      const bargeInState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        wasPausedByBargeIn: true,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        bargeInState
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe(RESUME_CONFIRMATION_TEXT);
      expect(updatedState.wasPausedByBargeIn).toBe(false);
    });

    it("does NOT show resume overlay on normal seek_and_play (no barge-in)", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 30}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe("");
    });

    it("does NOT show resume overlay on normal resume_video (no barge-in)", () => {
      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.videoOverlayText).toBe("");
    });

    it("auto-clears resume overlay after RESUME_CONFIRMATION_DURATION_MS", () => {
      const bargeInState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        wasPausedByBargeIn: true,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        bargeInState
      );

      vi.advanceTimersByTime(RESUME_CONFIRMATION_DURATION_MS);

      const clearUpdater = mockCallbacks.capturedStateUpdates.at(-1)!;
      const clearedState = clearUpdater({
        ...INITIAL_VIDEO_PLAYER_STATE,
        videoOverlayText: RESUME_CONFIRMATION_TEXT,
      });
      expect(clearedState.videoOverlayText).toBe("");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Last-played position tracking                                     */
  /* ------------------------------------------------------------------ */
  describe("last-played position tracking", () => {
    it("seek_and_play sets lastNarratedChapterTimestampSeconds and clears lastPausedAtSeconds", () => {
      const pausedState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        lastPausedAtSeconds: 20,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 55}',
        mockCallbacks,
        pausedState
      );

      const updatedState = applyStateUpdate(mockCallbacks, pausedState);
      expect(updatedState.lastNarratedChapterTimestampSeconds).toBe(55);
      expect(updatedState.lastPausedAtSeconds).toBeNull();
    });

    it("pause_video sets lastPausedAtSeconds to videoElement.currentTime", () => {
      const playingVideoElement = createMockVideoElement({
        currentTime: 72.3,
      } as Partial<HTMLVideoElement>);

      dispatchVideoFunctionCall(
        playingVideoElement,
        "pause_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      const updatedState = applyStateUpdate(mockCallbacks);
      expect(updatedState.lastPausedAtSeconds).toBe(72.3);
    });

    it("resume_video clears lastPausedAtSeconds", () => {
      const pausedState: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        lastPausedAtSeconds: 42,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        pausedState
      );

      const updatedState = applyStateUpdate(mockCallbacks, pausedState);
      expect(updatedState.lastPausedAtSeconds).toBeNull();
    });

    it("pause_video response includes last narrated chapter context", () => {
      const stateWithChapter: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        lastNarratedChapterTimestampSeconds: 55,
      };

      const playingVideoElement = createMockVideoElement({
        currentTime: 72,
      } as Partial<HTMLVideoElement>);

      const videoFunctionResult = dispatchVideoFunctionCall(
        playingVideoElement,
        "pause_video",
        "{}",
        mockCallbacks,
        stateWithChapter
      );

      expect(videoFunctionResult).toContain("72 seconds");
      expect(videoFunctionResult).toContain("Last narrated chapter started at 55 seconds");
    });

    it("resume_video response includes last narrated chapter context", () => {
      const stateWithChapter: VideoPlayerState = {
        ...INITIAL_VIDEO_PLAYER_STATE,
        lastNarratedChapterTimestampSeconds: 30,
      };

      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        mockCallbacks,
        stateWithChapter
      );

      expect(videoFunctionResult).toContain("Last narrated chapter was at 30 seconds");
    });

    it("pause_video omits chapter context when no chapter was narrated", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "pause_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).not.toContain("Last narrated chapter");
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Metrics accumulator recording in handlers                         */
  /* ------------------------------------------------------------------ */
  describe("metrics accumulator recording", () => {
    it("seek_and_play records chapter seek and play started", () => {
      const mockMetricsAccumulator = {
        recordChapterSeek: vi.fn(),
        recordPlayStarted: vi.fn(),
        recordPlayStopped: vi.fn(),
        recordBargeInPause: vi.fn(),
        recordSpeedChange: vi.fn(),
        recordOverlayText: vi.fn(),
      };
      const callbacksWithMetrics = {
        ...mockCallbacks,
        metricsAccumulator: mockMetricsAccumulator as never,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        '{"timestamp_seconds": 30}',
        callbacksWithMetrics,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockMetricsAccumulator.recordChapterSeek).toHaveBeenCalledWith(30);
      expect(mockMetricsAccumulator.recordPlayStarted).toHaveBeenCalledOnce();
    });

    it("pause_video records play stopped", () => {
      const mockMetricsAccumulator = {
        recordChapterSeek: vi.fn(),
        recordPlayStarted: vi.fn(),
        recordPlayStopped: vi.fn(),
        recordBargeInPause: vi.fn(),
        recordSpeedChange: vi.fn(),
        recordOverlayText: vi.fn(),
      };
      const callbacksWithMetrics = {
        ...mockCallbacks,
        metricsAccumulator: mockMetricsAccumulator as never,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "pause_video",
        "{}",
        callbacksWithMetrics,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockMetricsAccumulator.recordPlayStopped).toHaveBeenCalledOnce();
    });

    it("resume_video records play started", () => {
      const mockMetricsAccumulator = {
        recordChapterSeek: vi.fn(),
        recordPlayStarted: vi.fn(),
        recordPlayStopped: vi.fn(),
        recordBargeInPause: vi.fn(),
        recordSpeedChange: vi.fn(),
        recordOverlayText: vi.fn(),
      };
      const callbacksWithMetrics = {
        ...mockCallbacks,
        metricsAccumulator: mockMetricsAccumulator as never,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "resume_video",
        "{}",
        callbacksWithMetrics,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockMetricsAccumulator.recordPlayStarted).toHaveBeenCalledOnce();
    });

    it("set_playback_speed records speed change", () => {
      const mockMetricsAccumulator = {
        recordChapterSeek: vi.fn(),
        recordPlayStarted: vi.fn(),
        recordPlayStopped: vi.fn(),
        recordBargeInPause: vi.fn(),
        recordSpeedChange: vi.fn(),
        recordOverlayText: vi.fn(),
      };
      const callbacksWithMetrics = {
        ...mockCallbacks,
        metricsAccumulator: mockMetricsAccumulator as never,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "set_playback_speed",
        '{"speed": 1.5}',
        callbacksWithMetrics,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockMetricsAccumulator.recordSpeedChange).toHaveBeenCalledWith(1.5);
    });

    it("show_overlay_text records overlay text", () => {
      const mockMetricsAccumulator = {
        recordChapterSeek: vi.fn(),
        recordPlayStarted: vi.fn(),
        recordPlayStopped: vi.fn(),
        recordBargeInPause: vi.fn(),
        recordSpeedChange: vi.fn(),
        recordOverlayText: vi.fn(),
      };
      const callbacksWithMetrics = {
        ...mockCallbacks,
        metricsAccumulator: mockMetricsAccumulator as never,
      };

      dispatchVideoFunctionCall(
        mockVideoElement,
        "show_overlay_text",
        '{"text": "Key Feature"}',
        callbacksWithMetrics,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(mockMetricsAccumulator.recordOverlayText).toHaveBeenCalledWith("Key Feature");
    });

    it("handlers work without metricsAccumulator (optional)", () => {
      expect(() => {
        dispatchVideoFunctionCall(
          mockVideoElement,
          "seek_and_play",
          '{"timestamp_seconds": 10}',
          mockCallbacks,
          INITIAL_VIDEO_PLAYER_STATE
        );
      }).not.toThrow();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Barge-in pause metrics recording                                  */
  /* ------------------------------------------------------------------ */
  describe("pauseVideoElementOnBargeIn metrics", () => {
    it("records barge-in pause and play stopped on the accumulator", () => {
      const mockMetricsAccumulator = {
        recordBargeInPause: vi.fn(),
        recordPlayStopped: vi.fn(),
      };
      const playingVideoElement = createMockVideoElement({
        paused: false,
        currentTime: 42,
      } as Partial<HTMLVideoElement>);

      pauseVideoElementOnBargeIn(playingVideoElement, {
        setVideoPlayerState: mockCallbacks.setVideoPlayerState,
        metricsAccumulator: mockMetricsAccumulator as never,
      });

      expect(mockMetricsAccumulator.recordBargeInPause).toHaveBeenCalledWith(42);
      expect(mockMetricsAccumulator.recordPlayStopped).toHaveBeenCalledOnce();
    });

    it("sets wasPausedByBargeIn and lastPausedAtSeconds on barge-in", () => {
      const playingVideoElement = createMockVideoElement({
        paused: false,
        currentTime: 55.5,
      } as Partial<HTMLVideoElement>);

      pauseVideoElementOnBargeIn(playingVideoElement, {
        setVideoPlayerState: mockCallbacks.setVideoPlayerState,
      });

      const updatedState = applyStateUpdate(mockCallbacks, {
        ...INITIAL_VIDEO_PLAYER_STATE,
        isVideoPlaying: true,
      });
      expect(updatedState.wasPausedByBargeIn).toBe(true);
      expect(updatedState.lastPausedAtSeconds).toBe(55.5);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Error paths                                                        */
  /* ------------------------------------------------------------------ */
  describe("error paths", () => {
    it("returns error when video element is null", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        null,
        "seek_and_play",
        '{"timestamp_seconds": 10}',
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Video player is not available");
      expect(mockCallbacks.setVideoPlayerState).not.toHaveBeenCalled();
    });

    it("returns error on malformed JSON arguments", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "seek_and_play",
        "not json at all",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Failed to parse function arguments");
    });

    it("returns error for unknown function name", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "explode_video",
        "{}",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Unknown video function: explode_video");
    });

    it("handles empty argumentsJson for no-arg functions without parse error", () => {
      const videoFunctionResult = dispatchVideoFunctionCall(
        mockVideoElement,
        "pause_video",
        "",
        mockCallbacks,
        INITIAL_VIDEO_PLAYER_STATE
      );

      expect(videoFunctionResult).toContain("Video paused");
      expect(mockVideoElement.pause).toHaveBeenCalledOnce();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  resetVideoElement                                                  */
/* ------------------------------------------------------------------ */
describe("resetVideoElement", () => {
  it("resets video element to paused state at time 0 with speed 1", () => {
    const playingElement = createMockVideoElement({
      currentTime: 45,
      playbackRate: 2,
    } as Partial<HTMLVideoElement>);

    resetVideoElement(playingElement);

    expect(playingElement.pause).toHaveBeenCalledOnce();
    expect(playingElement.currentTime).toBe(0);
    expect(playingElement.playbackRate).toBe(1);
  });

  it("handles null element without throwing", () => {
    expect(() => resetVideoElement(null)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  pauseVideoElementOnBargeIn                                        */
/* ------------------------------------------------------------------ */
describe("pauseVideoElementOnBargeIn", () => {
  it("pauses a playing video and sets isVideoPlaying to false", () => {
    const playingVideoElement = createMockVideoElement({
      paused: false,
      currentTime: 25,
    } as Partial<HTMLVideoElement>);
    const bargeInCallbacks = createMockCallbacks();

    pauseVideoElementOnBargeIn(playingVideoElement, bargeInCallbacks);

    expect(playingVideoElement.pause).toHaveBeenCalledOnce();
    const updatedState = applyStateUpdate(bargeInCallbacks, {
      ...INITIAL_VIDEO_PLAYER_STATE,
      isVideoPlaying: true,
    });
    expect(updatedState.isVideoPlaying).toBe(false);
  });

  it("emits structured log with currentTime when pausing on barge-in", () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const playingVideoElement = createMockVideoElement({
      paused: false,
      currentTime: 42.5,
    } as Partial<HTMLVideoElement>);
    const bargeInCallbacks = createMockCallbacks();

    pauseVideoElementOnBargeIn(playingVideoElement, bargeInCallbacks);

    expect(consoleInfoSpy).toHaveBeenCalledOnce();
    const parsedLogEntry = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
    expect(parsedLogEntry.event).toBe("video_paused_on_barge_in");
    expect(parsedLogEntry.component).toBe("use_video_player");
    expect(parsedLogEntry.payload.currentTime).toBe(42.5);
    consoleInfoSpy.mockRestore();
  });

  it("does nothing when video is already paused", () => {
    const pausedVideoElement = createMockVideoElement({ paused: true } as Partial<HTMLVideoElement>);
    const bargeInCallbacks = createMockCallbacks();

    pauseVideoElementOnBargeIn(pausedVideoElement, bargeInCallbacks);

    expect(pausedVideoElement.pause).not.toHaveBeenCalled();
    expect(bargeInCallbacks.setVideoPlayerState).not.toHaveBeenCalled();
  });

  it("does nothing when video element is null", () => {
    const bargeInCallbacks = createMockCallbacks();

    pauseVideoElementOnBargeIn(null, bargeInCallbacks);

    expect(bargeInCallbacks.setVideoPlayerState).not.toHaveBeenCalled();
  });
});
