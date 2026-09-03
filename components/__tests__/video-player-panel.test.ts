// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { createElement } from "react";
import { VideoPlayerPanel } from "../VideoPlayerPanel";

const mockDashPlayerDestroy = vi.fn();
const mockDashPlayerInitialize = vi.fn();
const mockDashPlayerUpdateSettings = vi.fn();

vi.mock("dashjs", () => ({
  MediaPlayer: () => ({
    create: () => ({
      initialize: mockDashPlayerInitialize,
      updateSettings: mockDashPlayerUpdateSettings,
      destroy: mockDashPlayerDestroy,
    }),
  }),
}));

const DEFAULT_VIDEO_URL = "https://example.com/test.mpd";

function renderVideoPlayerPanel(
  propOverrides: Partial<{
    videoUrl: string;
    onVideoElementReady: (el: HTMLVideoElement | null) => void;
    isVideoPlaying: boolean;
    videoPlaybackSpeed: number;
    videoOverlayText: string;
    isVideoLoading: boolean;
    isVideoEnded: boolean;
    onVideoLoadStateChange: (isLoading: boolean) => void;
    onVideoEnded: () => void;
  }> = {}
) {
  const defaultProps = {
    videoUrl: DEFAULT_VIDEO_URL,
    onVideoElementReady: vi.fn(),
    isVideoPlaying: false,
    videoPlaybackSpeed: 1,
    videoOverlayText: "",
    isVideoLoading: false,
    isVideoEnded: false,
    onVideoLoadStateChange: vi.fn(),
    onVideoEnded: vi.fn(),
    ...propOverrides,
  };
  return {
    ...render(createElement(VideoPlayerPanel, defaultProps)),
    props: defaultProps,
  };
}

describe("VideoPlayerPanel (component rendering)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders video element with muted attribute for agent-narrated playback", () => {
    renderVideoPlayerPanel();
    const videoElement = document.getElementById(
      "videoplayer_panel_video"
    ) as HTMLVideoElement;
    expect(videoElement).not.toBeNull();
    expect(videoElement.tagName).toBe("VIDEO");
    expect(videoElement.muted).toBe(true);
  });

  it("renders 'Video Demo' header identifying the panel", () => {
    const { container } = renderVideoPlayerPanel();
    const videoPlayerPanelHeader = container.querySelector("h2");
    expect(videoPlayerPanelHeader).not.toBeNull();
    expect(videoPlayerPanelHeader!.textContent).toBe("Video Demo");
  });

  it("shows 'playing' badge when isVideoPlaying is true", () => {
    const { container } = renderVideoPlayerPanel({ isVideoPlaying: true });
    const allSpansText = Array.from(
      container.querySelectorAll("#videoplayer_panel_root span")
    ).map((span) => span.textContent);
    expect(allSpansText).toContain("playing");
  });

  it("hides 'playing' badge when isVideoPlaying is false", () => {
    const { container } = renderVideoPlayerPanel({ isVideoPlaying: false });
    const allSpansText = Array.from(
      container.querySelectorAll("#videoplayer_panel_root span")
    ).map((span) => span.textContent);
    expect(allSpansText).not.toContain("playing");
  });

  it("shows speed badge with value when videoPlaybackSpeed is not 1", () => {
    const { container } = renderVideoPlayerPanel({
      videoPlaybackSpeed: 1.5,
    });
    const allSpansText = Array.from(
      container.querySelectorAll("#videoplayer_panel_root span")
    ).map((span) => span.textContent);
    expect(allSpansText).toContain("1.5x");
  });

  it("hides speed badge when videoPlaybackSpeed is 1 (default)", () => {
    const { container } = renderVideoPlayerPanel({ videoPlaybackSpeed: 1 });
    const allSpansText = Array.from(
      container.querySelectorAll("#videoplayer_panel_root span")
    ).map((span) => span.textContent);
    const speedBadgePresent = allSpansText.some((spanText) =>
      /\d+(\.\d+)?x/.test(spanText || "")
    );
    expect(speedBadgePresent).toBe(false);
  });

  it("shows overlay text when videoOverlayText is non-empty", () => {
    renderVideoPlayerPanel({ videoOverlayText: "Key Feature: Auto-Stop" });
    const overlayElement = document.getElementById(
      "videoplayer_panel_overlay"
    );
    expect(overlayElement).not.toBeNull();
    const overlayParagraph = overlayElement!.querySelector("p");
    expect(overlayParagraph!.textContent).toBe("Key Feature: Auto-Stop");
  });

  it("fades overlay to invisible when videoOverlayText is empty", () => {
    renderVideoPlayerPanel({ videoOverlayText: "" });
    const overlayElement = document.getElementById(
      "videoplayer_panel_overlay"
    );
    expect(overlayElement).not.toBeNull();
    expect(overlayElement!.className).toContain("opacity-0");
    expect(overlayElement!.className).toContain("pointer-events-none");
  });

  it("calls onVideoElementReady with the video element after dashjs init", async () => {
    const onVideoElementReadySpy = vi.fn();
    renderVideoPlayerPanel({
      onVideoElementReady: onVideoElementReadySpy,
    });

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(onVideoElementReadySpy).toHaveBeenCalledWith(
      expect.any(HTMLVideoElement)
    );
  });

  it("calls onVideoElementReady with null on unmount", async () => {
    const onVideoElementReadySpy = vi.fn();
    const { unmount } = renderVideoPlayerPanel({
      onVideoElementReady: onVideoElementReadySpy,
    });

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    onVideoElementReadySpy.mockClear();
    unmount();

    expect(onVideoElementReadySpy).toHaveBeenCalledWith(null);
  });

  it("has correct DOM IDs for external selectors", () => {
    renderVideoPlayerPanel();
    expect(
      document.getElementById("videoplayer_panel_root")
    ).not.toBeNull();
    expect(
      document.getElementById("videoplayer_panel_video")
    ).not.toBeNull();
  });

  it("renders both playing badge and speed badge simultaneously", () => {
    const { container } = renderVideoPlayerPanel({
      isVideoPlaying: true,
      videoPlaybackSpeed: 2,
    });
    const allSpansText = Array.from(
      container.querySelectorAll("#videoplayer_panel_root span")
    ).map((span) => span.textContent);
    expect(allSpansText).toContain("playing");
    expect(allSpansText).toContain("2x");
  });

  it("shows loading spinner when isVideoLoading is true", () => {
    renderVideoPlayerPanel({ isVideoLoading: true });
    const loadingElement = document.getElementById(
      "videoplayer_panel_loading"
    );
    expect(loadingElement).not.toBeNull();
    expect(loadingElement!.textContent).toContain("Loading demo video");
  });

  it("hides loading spinner when isVideoLoading is false", () => {
    renderVideoPlayerPanel({ isVideoLoading: false });
    const loadingElement = document.getElementById(
      "videoplayer_panel_loading"
    );
    expect(loadingElement).toBeNull();
  });

  it("shows 'ended' badge when isVideoEnded is true and not playing", () => {
    const { container } = renderVideoPlayerPanel({
      isVideoEnded: true,
      isVideoPlaying: false,
    });
    const endedBadge = document.getElementById(
      "videoplayer_panel_endedBadge"
    );
    expect(endedBadge).not.toBeNull();
    expect(endedBadge!.textContent).toBe("ended");
  });

  it("hides 'ended' badge when video is playing (even if ended was set)", () => {
    renderVideoPlayerPanel({
      isVideoEnded: true,
      isVideoPlaying: true,
    });
    const endedBadge = document.getElementById(
      "videoplayer_panel_endedBadge"
    );
    expect(endedBadge).toBeNull();
  });

  it("overlay has opacity-100 when text is present (fade visible)", () => {
    renderVideoPlayerPanel({ videoOverlayText: "Feature highlight" });
    const overlayElement = document.getElementById(
      "videoplayer_panel_overlay"
    );
    expect(overlayElement).not.toBeNull();
    expect(overlayElement!.className).toContain("opacity-100");
    expect(overlayElement!.className).not.toContain("pointer-events-none");
  });

  it("overlay has transition-opacity for smooth fade animation", () => {
    renderVideoPlayerPanel({ videoOverlayText: "" });
    const overlayElement = document.getElementById(
      "videoplayer_panel_overlay"
    );
    expect(overlayElement).not.toBeNull();
    expect(overlayElement!.className).toContain("transition-opacity");
    expect(overlayElement!.className).toContain("duration-200");
  });
});
