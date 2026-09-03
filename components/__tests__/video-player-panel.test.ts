import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

function readVideoPlayerPanel(): string {
  return fs.readFileSync(
    path.resolve(process.cwd(), "components/VideoPlayerPanel.tsx"),
    "utf8"
  );
}

describe("VideoPlayerPanel (source-level contract verification)", () => {
  let panelSource: string;

  beforeEach(() => {
    panelSource = readVideoPlayerPanel();
  });

  it("uses dashjs dynamic import for DASH adaptive streaming", () => {
    expect(panelSource).toContain('await import("dashjs")');
    expect(panelSource).toContain("dashjs.MediaPlayer().create()");
    expect(panelSource).toContain("playerInstance.initialize(videoElement, videoUrl, false)");
  });

  it("video element is always muted (agent is the narrator)", () => {
    expect(panelSource).toContain("muted");
    expect(panelSource).toContain("playsInline");
  });

  it("calls onVideoElementReady with element on init and null on cleanup", () => {
    expect(panelSource).toContain(
      "onVideoElementReadyRef.current(videoElement)"
    );
    expect(panelSource).toContain("onVideoElementReadyRef.current(null)");
  });

  it("destroys dashjs player on cleanup to prevent memory leaks", () => {
    expect(panelSource).toContain("dashMediaPlayerInstance.destroy()");
  });

  it("has structured logging for init and destroy failures", () => {
    expect(panelSource).toContain('event: "dash_player_initialized"');
    expect(panelSource).toContain('event: "dash_player_init_failed"');
    expect(panelSource).toContain('event: "dash_player_destroy_failed"');
  });

  it("has DOM IDs with videoplayer prefix per convention", () => {
    expect(panelSource).toContain('id="videoplayer_panel_root"');
    expect(panelSource).toContain('id="videoplayer_panel_video"');
    expect(panelSource).toContain('id="videoplayer_panel_overlay"');
  });

  it("shows playing indicator when isVideoPlaying is true", () => {
    expect(panelSource).toContain("{isVideoPlaying && (");
    expect(panelSource).toContain("playing");
  });

  it("shows speed indicator when videoPlaybackSpeed is not 1", () => {
    expect(panelSource).toContain("videoPlaybackSpeed !== 1");
    expect(panelSource).toContain("{videoPlaybackSpeed}x");
  });

  it("renders overlay text when videoOverlayText is non-empty", () => {
    expect(panelSource).toContain("{videoOverlayText && (");
    expect(panelSource).toContain("{videoOverlayText}");
  });

  it("updates onVideoElementReady ref in useEffect (not during render)", () => {
    expect(panelSource).toContain("useEffect(() => {");
    expect(panelSource).toContain(
      "onVideoElementReadyRef.current = onVideoElementReady"
    );
  });
});
