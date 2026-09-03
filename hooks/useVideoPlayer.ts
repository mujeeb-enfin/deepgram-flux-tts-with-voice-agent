"use client";

import { useRef, useCallback, useState } from "react";
import {
  type VideoPlayerState,
  INITIAL_VIDEO_PLAYER_STATE,
  dispatchVideoFunctionCall,
  resetVideoElement,
} from "./useVideoPlayer.handlers";

export type { VideoPlayerState };

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
    resetVideoPlayer,
  };
}
