"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerPanelProps {
  videoUrl: string;
  onVideoElementReady: (videoElement: HTMLVideoElement | null) => void;
  isVideoPlaying: boolean;
  videoPlaybackSpeed: number;
  videoOverlayText: string;
}

export function VideoPlayerPanel({
  videoUrl,
  onVideoElementReady,
  isVideoPlaying,
  videoPlaybackSpeed,
  videoOverlayText,
}: VideoPlayerPanelProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const onVideoElementReadyRef = useRef(onVideoElementReady);
  useEffect(() => {
    onVideoElementReadyRef.current = onVideoElementReady;
  }, [onVideoElementReady]);

  useEffect(() => {
    let dashMediaPlayerInstance: { destroy: () => void } | null = null;

    async function initializeDashPlayer() {
      const videoElement = internalVideoRef.current;
      if (!videoElement) return;

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
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "video_player_panel",
            event: "dash_player_init_failed",
            payload: { error: String(dashInitError), videoUrl },
          })
        );
      }
    }

    initializeDashPlayer();

    return () => {
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
            <span className="font-mono text-[10px] tracking-wide text-live">playing</span>
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

        {videoOverlayText && (
          <div
            id="videoplayer_panel_overlay"
            className="absolute inset-x-0 bottom-0 flex items-end justify-center p-4"
          >
            <div className="rounded-lg bg-black/75 px-4 py-2.5 backdrop-blur-sm">
              <p className="text-center text-sm font-medium leading-snug text-white">
                {videoOverlayText}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
