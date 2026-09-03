"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerPanelProps {
  videoUrl: string;
  onVideoElementReady: (videoElement: HTMLVideoElement | null) => void;
  isVideoPlaying: boolean;
  videoPlaybackSpeed: number;
  videoOverlayText: string;
  isVideoLoading: boolean;
  isVideoEnded: boolean;
  onVideoLoadStateChange: (isLoading: boolean) => void;
  onVideoEnded: () => void;
}

export function VideoPlayerPanel({
  videoUrl,
  onVideoElementReady,
  isVideoPlaying,
  videoPlaybackSpeed,
  videoOverlayText,
  isVideoLoading,
  isVideoEnded,
  onVideoLoadStateChange,
  onVideoEnded,
}: VideoPlayerPanelProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const onVideoElementReadyRef = useRef(onVideoElementReady);
  const onVideoLoadStateChangeRef = useRef(onVideoLoadStateChange);
  const onVideoEndedRef = useRef(onVideoEnded);

  useEffect(() => {
    onVideoElementReadyRef.current = onVideoElementReady;
  }, [onVideoElementReady]);

  useEffect(() => {
    onVideoLoadStateChangeRef.current = onVideoLoadStateChange;
  }, [onVideoLoadStateChange]);

  useEffect(() => {
    onVideoEndedRef.current = onVideoEnded;
  }, [onVideoEnded]);

  useEffect(() => {
    let dashMediaPlayerInstance: { destroy: () => void } | null = null;

    async function initializeDashPlayer() {
      const videoElement = internalVideoRef.current;
      if (!videoElement) return;

      const handleLoadedMetadata = () => {
        onVideoLoadStateChangeRef.current(false);
      };
      const handleVideoEndedEvent = () => {
        onVideoEndedRef.current();
      };
      const handleVideoError = () => {
        onVideoLoadStateChangeRef.current(false);
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "video_player_panel",
            event: "video_element_error",
            payload: { videoUrl },
          })
        );
      };

      videoElement.addEventListener("loadedmetadata", handleLoadedMetadata);
      videoElement.addEventListener("ended", handleVideoEndedEvent);
      videoElement.addEventListener("error", handleVideoError);

      try {
        const dashjs = await import("dashjs");
        const playerInstance = dashjs.MediaPlayer().create();
        playerInstance.initialize(videoElement, videoUrl, false);
        playerInstance.updateSettings({
          streaming: {
            buffer: {
              fastSwitchEnabled: true,
            },
          },
        });

        dashMediaPlayerInstance = playerInstance;
        onVideoElementReadyRef.current(videoElement);

        console.info(
          JSON.stringify({
            level: "info",
            component: "video_player_panel",
            event: "dash_player_initialized",
            payload: { videoUrl },
          })
        );
      } catch (dashInitError) {
        onVideoLoadStateChangeRef.current(false);
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "video_player_panel",
            event: "dash_player_init_failed",
            payload: { error: String(dashInitError), videoUrl },
          })
        );
      }

      return () => {
        videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
        videoElement.removeEventListener("ended", handleVideoEndedEvent);
        videoElement.removeEventListener("error", handleVideoError);
      };
    }

    let cleanupListeners: (() => void) | undefined;
    initializeDashPlayer().then((cleanup) => {
      cleanupListeners = cleanup;
    });

    return () => {
      cleanupListeners?.();
      if (dashMediaPlayerInstance) {
        try {
          dashMediaPlayerInstance.destroy();
        } catch (dashDestroyError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              component: "video_player_panel",
              event: "dash_player_destroy_failed",
              payload: { error: String(dashDestroyError) },
            })
          );
        }
      }
      onVideoElementReadyRef.current(null);
    };
  }, [videoUrl]);

  const hasOverlayText = videoOverlayText.length > 0;

  return (
    <section
      id="videoplayer_panel_root"
      className="overflow-hidden rounded-[10px] border border-line bg-panel"
    >
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          Video Demo
        </h2>
        <div className="flex items-center gap-2">
          {isVideoPlaying && (
            <span id="videoplayer_panel_playingBadge" className="font-mono text-[10px] tracking-wide text-live">playing</span>
          )}
          {isVideoEnded && !isVideoPlaying && (
            <span id="videoplayer_panel_endedBadge" className="font-mono text-[10px] tracking-wide text-ink3">ended</span>
          )}
          {videoPlaybackSpeed !== 1 && (
            <span className="font-mono text-[10px] tracking-wide text-ink3">
              {videoPlaybackSpeed}x
            </span>
          )}
        </div>
      </div>

      <div ref={videoContainerRef} className="relative bg-black">
        <video
          ref={internalVideoRef}
          id="videoplayer_panel_video"
          className="w-full"
          muted
          playsInline
        />

        {isVideoLoading && (
          <div
            id="videoplayer_panel_loading"
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex items-center gap-2.5 rounded-lg bg-black/75 px-4 py-2.5 backdrop-blur-sm">
              <svg
                className="h-4 w-4 animate-spin text-white"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm font-medium text-white">Loading demo video</span>
            </div>
          </div>
        )}

        <div
          id="videoplayer_panel_overlay"
          className={`absolute inset-x-0 bottom-0 flex items-end justify-center p-4 transition-opacity duration-200 ${
            hasOverlayText ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="rounded-lg bg-black/75 px-4 py-2.5 backdrop-blur-sm">
            <p className="text-center text-sm font-medium leading-snug text-white">
              {videoOverlayText}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
