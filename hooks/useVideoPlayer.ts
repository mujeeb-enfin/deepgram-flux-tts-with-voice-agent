"use client";

import { useRef, useCallback, useState } from "react";
import type { VideoFunctionName } from "@/lib/deepgram/function-call-types";

export interface VideoPlayerState {
  isVideoPlaying: boolean;
  videoPlaybackSpeed: number;
  videoOverlayText: string;
}

const INITIAL_VIDEO_PLAYER_STATE: VideoPlayerState = {
  isVideoPlaying: false,
  videoPlaybackSpeed: 1,
  videoOverlayText: "",
};

interface SeekAndPlayArguments {
  timestamp_seconds: number;
}

interface SetPlaybackSpeedArguments {
  speed: number;
}

interface ShowOverlayTextArguments {
  text: string;
  duration_seconds?: number;
}

const ALLOWED_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
const DEFAULT_OVERLAY_DURATION_SECONDS = 5;

export function useVideoPlayer() {
  const dashPlayerRef = useRef<unknown>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [videoPlayerState, setVideoPlayerState] = useState<VideoPlayerState>(
    INITIAL_VIDEO_PLAYER_STATE
  );

  const clearOverlayTimer = useCallback(() => {
    if (overlayTimerRef.current) {
      clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
  }, []);

  const handleVideoFunctionCall = useCallback(
    (functionName: string, argumentsJson: string): string => {
      const videoElement = videoElementRef.current;

      if (!videoElement) {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "use_video_player",
            event: "video_function_call_no_element",
            payload: { functionName },
          })
        );
        return `Video player is not available. The current product does not have a demo video configured.`;
      }

      let parsedArguments: Record<string, unknown> = {};
      if (argumentsJson && argumentsJson !== "{}") {
        try {
          parsedArguments = JSON.parse(argumentsJson);
        } catch (videoFunctionArgumentParseError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              component: "use_video_player",
              event: "video_function_argument_parse_failed",
              payload: {
                functionName,
                error: String(videoFunctionArgumentParseError),
              },
            })
          );
          return `Failed to parse function arguments: ${String(videoFunctionArgumentParseError)}`;
        }
      }

      const videoFunctionName = functionName as VideoFunctionName;

      switch (videoFunctionName) {
        case "seek_and_play": {
          const seekArguments = parsedArguments as unknown as SeekAndPlayArguments;
          const targetTimestamp = Number(seekArguments.timestamp_seconds);
          if (isNaN(targetTimestamp) || targetTimestamp < 0) {
            return `Invalid timestamp: ${seekArguments.timestamp_seconds}`;
          }
          const clampedTimestamp = Math.min(targetTimestamp, videoElement.duration || Infinity);
          videoElement.currentTime = clampedTimestamp;
          videoElement.play().catch((videoPlayError) => {
            console.warn(
              JSON.stringify({
                level: "warn",
                component: "use_video_player",
                event: "video_play_failed",
                payload: { error: String(videoPlayError) },
              })
            );
          });
          setVideoPlayerState((prev) => ({ ...prev, isVideoPlaying: true }));
          console.info(
            JSON.stringify({
              level: "info",
              component: "use_video_player",
              event: "video_seek_and_play",
              payload: { targetTimestamp: clampedTimestamp },
            })
          );
          return `Video is now playing from ${Math.round(clampedTimestamp)} seconds.`;
        }

        case "pause_video": {
          videoElement.pause();
          setVideoPlayerState((prev) => ({ ...prev, isVideoPlaying: false }));
          console.info(
            JSON.stringify({
              level: "info",
              component: "use_video_player",
              event: "video_paused",
              payload: { currentTime: videoElement.currentTime },
            })
          );
          return `Video paused at ${Math.round(videoElement.currentTime)} seconds.`;
        }

        case "resume_video": {
          videoElement.play().catch((videoResumeError) => {
            console.warn(
              JSON.stringify({
                level: "warn",
                component: "use_video_player",
                event: "video_resume_failed",
                payload: { error: String(videoResumeError) },
              })
            );
          });
          setVideoPlayerState((prev) => ({ ...prev, isVideoPlaying: true }));
          console.info(
            JSON.stringify({
              level: "info",
              component: "use_video_player",
              event: "video_resumed",
              payload: { currentTime: videoElement.currentTime },
            })
          );
          return `Video resumed from ${Math.round(videoElement.currentTime)} seconds.`;
        }

        case "set_playback_speed": {
          const speedArguments = parsedArguments as unknown as SetPlaybackSpeedArguments;
          const requestedSpeed = Number(speedArguments.speed);
          if (!ALLOWED_PLAYBACK_SPEEDS.includes(requestedSpeed)) {
            return `Invalid speed: ${speedArguments.speed}. Allowed: ${ALLOWED_PLAYBACK_SPEEDS.join(", ")}`;
          }
          videoElement.playbackRate = requestedSpeed;
          setVideoPlayerState((prev) => ({
            ...prev,
            videoPlaybackSpeed: requestedSpeed,
          }));
          console.info(
            JSON.stringify({
              level: "info",
              component: "use_video_player",
              event: "video_speed_changed",
              payload: { speed: requestedSpeed },
            })
          );
          return `Video playback speed set to ${requestedSpeed}x.`;
        }

        case "show_overlay_text": {
          const overlayArguments = parsedArguments as unknown as ShowOverlayTextArguments;
          const overlayText = String(overlayArguments.text || "");
          const overlayDurationSeconds =
            Number(overlayArguments.duration_seconds) || DEFAULT_OVERLAY_DURATION_SECONDS;

          clearOverlayTimer();
          setVideoPlayerState((prev) => ({
            ...prev,
            videoOverlayText: overlayText,
          }));
          overlayTimerRef.current = setTimeout(() => {
            setVideoPlayerState((prev) => ({ ...prev, videoOverlayText: "" }));
            overlayTimerRef.current = null;
          }, overlayDurationSeconds * 1000);

          console.info(
            JSON.stringify({
              level: "info",
              component: "use_video_player",
              event: "video_overlay_shown",
              payload: { text: overlayText, durationSeconds: overlayDurationSeconds },
            })
          );
          return `Showing overlay text: "${overlayText}" for ${overlayDurationSeconds} seconds.`;
        }

        default: {
          console.warn(
            JSON.stringify({
              level: "warn",
              component: "use_video_player",
              event: "unknown_video_function",
              payload: { functionName },
            })
          );
          return `Unknown video function: ${functionName}`;
        }
      }
    },
    [clearOverlayTimer]
  );

  const setVideoElement = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
  }, []);

  const resetVideoPlayer = useCallback(() => {
    clearOverlayTimer();
    const videoElement = videoElementRef.current;
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0;
      videoElement.playbackRate = 1;
    }
    setVideoPlayerState(INITIAL_VIDEO_PLAYER_STATE);
  }, [clearOverlayTimer]);

  return {
    videoPlayerState,
    setVideoElement,
    handleVideoFunctionCall,
    resetVideoPlayer,
  };
}
