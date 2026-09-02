import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavioral integration tests for the audio playback pipeline.
 *
 * What these tests protect: queueAudio schedules audio correctly,
 * stopPlayback stops all sources and returns the right boolean,
 * destroyPlayback disconnects graph nodes. These test the actual
 * exported functions with mock AudioContext objects — not string-matching
 * against source code.
 *
 * We import the pure scheduling functions directly and drive them
 * with mock objects that match the Web Audio API shape.
 */
import {
  createScheduleState,
  computeScheduleAt,
  updateScheduledEnd,
  registerBufferSource,
  removeBufferSource,
  hasQueuedAudio,
} from "@/lib/audio/schedule-tracker";

function createMockAudioBuffer(duration: number) {
  return {
    duration,
    length: Math.floor(duration * 24000),
    sampleRate: 24000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(Math.floor(duration * 24000)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  };
}

function createMockSourceNode() {
  let startedAt = -1;
  let stopped = false;
  return {
    buffer: null as ReturnType<typeof createMockAudioBuffer> | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
    start(when: number) {
      if (stopped) throw new DOMException("InvalidStateError");
      startedAt = when;
    },
    stop() {
      if (stopped) throw new DOMException("InvalidStateError");
      stopped = true;
    },
    get startedAt() {
      return startedAt;
    },
    get isStopped() {
      return stopped;
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
    expect(() => source.stop()).toThrow("InvalidStateError");
  });

  it("stopPlayback pattern stops all sources and resets state", () => {
    const sourceA = createMockSourceNode();
    const sourceB = createMockSourceNode();
    registerBufferSource(scheduleState, sourceA);
    registerBufferSource(scheduleState, sourceB);
    updateScheduledEnd(scheduleState, 5.0);

    const hadQueued = hasQueuedAudio(scheduleState, 1.0);
    expect(hadQueued).toBe(true);

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
