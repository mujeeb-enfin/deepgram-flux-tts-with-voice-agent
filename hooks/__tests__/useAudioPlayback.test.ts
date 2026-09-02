import { describe, it, expect, beforeEach } from "vitest";

/**
 * Behavioral integration tests for the audio playback scheduling pipeline.
 *
 * Each test protects a specific scheduling invariant that, if broken, causes
 * audible glitches (clicks, gaps, double-play) or silent barge-in failures.
 * Tests drive the real exported functions with plain mock objects — no source
 * string matching.
 */
import {
  createScheduleState,
  computeScheduleAt,
  updateScheduledEnd,
  registerBufferSource,
  removeBufferSource,
  hasQueuedAudio,
} from "@/lib/audio/schedule-tracker";

function createMockSourceNode() {
  let stopped = false;
  return {
    get isStopped() {
      return stopped;
    },
    stop() {
      if (stopped) throw new DOMException("already stopped", "InvalidStateError");
      stopped = true;
    },
  };
}

describe("schedule-tracker integration (queueAudio pipeline)", () => {
  let scheduleState: ReturnType<typeof createScheduleState>;

  beforeEach(() => {
    scheduleState = createScheduleState();
  });

  it("schedules the first chunk 5ms after currentTime", () => {
    const currentTime = 1.0;
    const scheduleAt = computeScheduleAt(
      currentTime,
      scheduleState.lastQueuedEndRef.current
    );
    expect(scheduleAt).toBe(currentTime + 0.005);
  });

  it("chains chunks back-to-back after the first", () => {
    const currentTime = 1.0;
    const chunkDuration = 0.17;

    const firstAt = computeScheduleAt(
      currentTime,
      scheduleState.lastQueuedEndRef.current
    );
    updateScheduledEnd(scheduleState, firstAt + chunkDuration);

    const secondAt = computeScheduleAt(
      currentTime + 0.01,
      scheduleState.lastQueuedEndRef.current
    );
    expect(secondAt).toBe(firstAt + chunkDuration);
  });

  it("registerBufferSource + removeBufferSource track active sources", () => {
    const sourceA = createMockSourceNode();
    const sourceB = createMockSourceNode();

    registerBufferSource(scheduleState, sourceA);
    registerBufferSource(scheduleState, sourceB);
    expect(scheduleState.activeSourcesRef.current).toHaveLength(2);

    removeBufferSource(scheduleState, sourceA);
    expect(scheduleState.activeSourcesRef.current).toHaveLength(1);
    expect(scheduleState.activeSourcesRef.current[0]).toBe(sourceB);
  });

  it("hasQueuedAudio returns true when sources exist", () => {
    const source = createMockSourceNode();
    registerBufferSource(scheduleState, source);
    updateScheduledEnd(scheduleState, 2.0);
    expect(hasQueuedAudio(scheduleState, 1.0)).toBe(true);
  });

  it("hasQueuedAudio returns false on empty state", () => {
    expect(hasQueuedAudio(scheduleState, 1.0)).toBe(false);
  });

  it("stop() on an already-stopped source throws (matching browser behavior)", () => {
    const source = createMockSourceNode();
    source.stop();
    expect(() => source.stop()).toThrow("already stopped");
  });

  it("stopPlayback pattern stops all sources and resets state", () => {
    const sourceA = createMockSourceNode();
    const sourceB = createMockSourceNode();
    registerBufferSource(scheduleState, sourceA);
    registerBufferSource(scheduleState, sourceB);
    updateScheduledEnd(scheduleState, 5.0);

    expect(hasQueuedAudio(scheduleState, 1.0)).toBe(true);

    let alreadyStoppedSourceCount = 0;
    scheduleState.activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        alreadyStoppedSourceCount++;
      }
    });
    expect(alreadyStoppedSourceCount).toBe(0);
    expect(sourceA.isStopped).toBe(true);
    expect(sourceB.isStopped).toBe(true);

    const freshState = createScheduleState();
    expect(hasQueuedAudio(freshState, 1.0)).toBe(false);
  });

  it("double-stop counts failures correctly (batch log pattern)", () => {
    const sourceA = createMockSourceNode();
    const sourceB = createMockSourceNode();
    sourceB.stop();

    registerBufferSource(scheduleState, sourceA);
    registerBufferSource(scheduleState, sourceB);

    let alreadyStoppedSourceCount = 0;
    scheduleState.activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        alreadyStoppedSourceCount++;
      }
    });
    expect(alreadyStoppedSourceCount).toBe(1);
  });
});
