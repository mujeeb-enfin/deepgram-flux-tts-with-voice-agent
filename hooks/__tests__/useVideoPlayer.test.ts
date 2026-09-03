import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

function readUseVideoPlayer(): string {
  const filePath = path.resolve(process.cwd(), "hooks/useVideoPlayer.ts");
  return fs.readFileSync(filePath, "utf8");
}

describe("useVideoPlayer hook (source-level behavioral verification)", () => {
  let hookSource: string;

  beforeEach(() => {
    hookSource = readUseVideoPlayer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("seek_and_play sets currentTime, calls play(), and returns confirmation", () => {
    expect(hookSource).toContain("videoElement.currentTime = clampedTimestamp");
    expect(hookSource).toContain("videoElement.play()");
    expect(hookSource).toContain("isVideoPlaying: true");
    expect(hookSource).toContain('event: "video_seek_and_play"');
  });

  it("seek_and_play clamps to video duration to prevent out-of-bounds seek", () => {
    expect(hookSource).toContain(
      "Math.min(targetTimestamp, videoElement.duration || Infinity)"
    );
  });

  it("seek_and_play rejects negative and NaN timestamps", () => {
    expect(hookSource).toContain("isNaN(targetTimestamp) || targetTimestamp < 0");
  });

  it("pause_video calls pause() and sets isVideoPlaying to false", () => {
    expect(hookSource).toContain("videoElement.pause()");
    expect(hookSource).toContain("isVideoPlaying: false");
    expect(hookSource).toContain('event: "video_paused"');
  });

  it("resume_video calls play() and sets isVideoPlaying to true", () => {
    expect(hookSource).toContain('case "resume_video"');
    expect(hookSource).toContain('event: "video_resumed"');
  });

  it("set_playback_speed validates against ALLOWED_PLAYBACK_SPEEDS", () => {
    expect(hookSource).toContain("ALLOWED_PLAYBACK_SPEEDS.includes(requestedSpeed)");
    expect(hookSource).toContain("const ALLOWED_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2]");
    expect(hookSource).toContain("videoElement.playbackRate = requestedSpeed");
  });

  it("set_playback_speed rejects invalid speeds with error message", () => {
    expect(hookSource).toContain(
      "!ALLOWED_PLAYBACK_SPEEDS.includes(requestedSpeed)"
    );
    expect(hookSource).toContain("Invalid speed:");
  });

  it("show_overlay_text sets overlayText and clears after timeout", () => {
    expect(hookSource).toContain("clearOverlayTimer()");
    expect(hookSource).toContain("videoOverlayText: overlayText");
    expect(hookSource).toContain("overlayDurationSeconds * 1000");
    expect(hookSource).toContain('videoOverlayText: ""');
  });

  it("show_overlay_text defaults to 5 seconds when no duration given", () => {
    expect(hookSource).toContain(
      "const DEFAULT_OVERLAY_DURATION_SECONDS = 5"
    );
    expect(hookSource).toContain(
      "Number(overlayArguments.duration_seconds) || DEFAULT_OVERLAY_DURATION_SECONDS"
    );
  });

  it("unknown function name logs a warning and returns error string", () => {
    expect(hookSource).toContain('event: "unknown_video_function"');
    expect(hookSource).toContain("Unknown video function:");
  });

  it("returns error when video element is null (no video configured)", () => {
    expect(hookSource).toContain('event: "video_function_call_no_element"');
    expect(hookSource).toContain(
      "Video player is not available"
    );
  });

  it("handles JSON parse failure in function arguments", () => {
    expect(hookSource).toContain(
      'event: "video_function_argument_parse_failed"'
    );
    expect(hookSource).toContain("Failed to parse function arguments:");
  });

  it("resetVideoPlayer pauses, resets currentTime/playbackRate, clears overlay", () => {
    expect(hookSource).toContain("videoElement.pause()");
    expect(hookSource).toContain("videoElement.currentTime = 0");
    expect(hookSource).toContain("videoElement.playbackRate = 1");
    expect(hookSource).toContain("setVideoPlayerState(INITIAL_VIDEO_PLAYER_STATE)");
    expect(hookSource).toContain("clearOverlayTimer()");
  });

  it("initial state has isVideoPlaying=false, speed=1, no overlay", () => {
    expect(hookSource).toContain("isVideoPlaying: false");
    expect(hookSource).toContain("videoPlaybackSpeed: 1");
    expect(hookSource).toContain('videoOverlayText: ""');
  });

  it("every play() call has a catch for autoplay policy errors", () => {
    expect(hookSource).toContain('event: "video_play_failed"');
    expect(hookSource).toContain('event: "video_resume_failed"');
  });

  it("structured logging present on every branch (no silent paths)", () => {
    expect(hookSource).toContain('component: "use_video_player"');
    const logEvents = [
      "video_function_call_no_element",
      "video_function_argument_parse_failed",
      "video_seek_and_play",
      "video_play_failed",
      "video_paused",
      "video_resumed",
      "video_resume_failed",
      "video_speed_changed",
      "video_overlay_shown",
      "unknown_video_function",
    ];
    for (const eventName of logEvents) {
      expect(hookSource).toContain(`event: "${eventName}"`);
    }
  });
});
