"use client";

import { useRef, useCallback, useState } from "react";
import {
  type VideoPlayerState,
  INITIAL_VIDEO_PLAYER_STATE,
  dispatchVideoFunctionCall,
  resetVideoElement,
  pauseVideoElementOnBargeIn,
} from "./useVideoPlayer.handlers";

export type { VideoPlayerState };

export function useVideoPlayer() {
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
      return dispatchVideoFunctionCall(
        videoElementRef.current,
        functionName,
        argumentsJson,
        {
          setVideoPlayerState,
          clearOverlayTimer,
          setOverlayTimer: (timer) => {
            overlayTimerRef.current = timer;
          },
        }
      );
    },
    [clearOverlayTimer]
  );

  const setVideoElement = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
    if (videoElement) {
      setVideoPlayerState((prev) => ({ ...prev, isVideoLoading: true }));
    }
  }, []);

  const pauseVideoOnBargeIn = useCallback(() => {
    pauseVideoElementOnBargeIn(videoElementRef.current, {
      setVideoPlayerState,
    });
  }, []);

  const handleVideoLoadStateChange = useCallback((isLoading: boolean) => {
    setVideoPlayerState((prev) => ({ ...prev, isVideoLoading: isLoading }));
  }, []);

  const handleVideoEnded = useCallback(() => {
    setVideoPlayerState((prev) => ({
      ...prev,
      isVideoPlaying: false,
      isVideoEnded: true,
    }));
    console.info(
      JSON.stringify({
        level: "info",
        component: "use_video_player",
        event: "video_playback_ended",
      })
    );
  }, []);

  const resetVideoPlayer = useCallback(() => {
    clearOverlayTimer();
    resetVideoElement(videoElementRef.current);
    setVideoPlayerState(INITIAL_VIDEO_PLAYER_STATE);
  }, [clearOverlayTimer]);

  return {
    videoPlayerState,
    setVideoElement,
    handleVideoFunctionCall,
    pauseVideoOnBargeIn,
    handleVideoLoadStateChange,
    handleVideoEnded,
    resetVideoPlayer,
  };
}
