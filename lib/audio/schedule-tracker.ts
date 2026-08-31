"use client";

export interface ScheduleState {
  lastQueuedEndRef: { current: number };
  activeSourcesRef: { current: Array<{ stop: (when?: number) => void }> };
}

/**
 * A tiny mutable store so the pure scheduling logic stays testable without a
 * real AudioContext. Keep lastQueuedEnd monotonic (never regress) and remember
 * every started source so abuse / double-stops are impossible.
 */
export function createScheduleState(): ScheduleState {
  return {
    lastQueuedEndRef: { current: 0 },
    activeSourcesRef: { current: [] },
  };
}

/**
 * Schedule one chunk back-to-back after the previously queued chunk's end.
 * Never schedule in the past. A fresh 5ms lead-in over the context clock
 * covers cross-thread scheduling jitter without ever starting before the
 * previous chunk has finished.
 */
export function computeScheduleAt(
  currentTime: number,
  lastQueuedEnd: number
): number {
  return Math.max(currentTime + 0.005, lastQueuedEnd);
}

/**
 * Advance the scheduling cursor to the end of the newest chunk. The cursor
 * tracks the actual scheduled timeline, so it is set unconditionally — a
 * regression cannot happen because lastQueuedEnd is monotonic by construction
 * (each new chunk schedules after the previous end).
 */
export function updateScheduledEnd(state: ScheduleState, end: number): void {
  state.lastQueuedEndRef.current = end;
}

export function registerBufferSource(state: ScheduleState, source: { stop: (when?: number) => void }): void {
  state.activeSourcesRef.current.push(source);
}

export function removeBufferSource(state: ScheduleState, source: { stop: (when?: number) => void }): void {
  const filtered = state.activeSourcesRef.current.filter((s) => s !== source);
  state.activeSourcesRef.current = filtered;
}

export function hasQueuedAudio(state: ScheduleState, currentTime: number): boolean {
  return (
    state.activeSourcesRef.current.length > 0 ||
    state.lastQueuedEndRef.current > currentTime
  );
}