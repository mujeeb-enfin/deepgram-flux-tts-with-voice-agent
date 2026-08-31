import { describe, it, expect } from "vitest";
import {
  computeScheduleAt,
  createScheduleState,
  hasQueuedAudio,
  registerBufferSource,
  removeBufferSource,
  updateScheduledEnd,
  type ScheduleState,
} from "../schedule-tracker";

describe("computeScheduleAt", () => {
  it("never schedules in the past, even when way behind the clock", () => {
    const at = computeScheduleAt(10.0, 9.5);
    expect(at).toBeGreaterThanOrEqual(10.0 + 0.005);
  });

  it("chains back-to-back after the previous chunk's end (no early start)", () => {
    const at = computeScheduleAt(10.0, 11.5);
    expect(at).toBe(11.5);
  });
});

describe("updateScheduledEnd", () => {
  it("sets the cursor to the newest scheduled end", () => {
    const state = createScheduleState();
    updateScheduledEnd(state, 5.0);
    expect(state.lastQueuedEndRef.current).toBe(5.0);
  });
});

describe("hasQueuedAudio + active source tracking", () => {
  it("reports queued audio when a source is registered and not yet ended", () => {
    const state = createScheduleState();
    updateScheduledEnd(state, 2.0);
    const source = { stop: () => {} };
    registerBufferSource(state, source);
    expect(hasQueuedAudio(state, 1.0)).toBe(true);
    removeBufferSource(state, source);
    // Still queued until the cursor passes the last scheduled end.
    expect(hasQueuedAudio(state, 1.0)).toBe(true);
    expect(hasQueuedAudio(state, 2.5)).toBe(false);
  });
});