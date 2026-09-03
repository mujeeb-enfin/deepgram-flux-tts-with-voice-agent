"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  type VideoPlayerState,
  INITIAL_VIDEO_PLAYER_STATE,
  dispatchVideoFunctionCall,
  resetVideoElement,
  pauseVideoElementOnBargeIn,
} from "./useVideoPlayer.handlers";
import {
  createVideoSessionMetrics,
  type VideoSessionMetricsAccumulator,
} from "@/lib/video/session-metrics";

export type { VideoPlayerState };

export function useVideoPlayer() {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsAccumulatorRef = useRef<VideoSessionMetricsAccumulator | null>(
    null
  );

  const [videoPlayerState, setVideoPlayerState] = useState<VideoPlayerState>(
    INITIAL_VIDEO_PLAYER_STATE
  );

  const videoPlayerStateRef = useRef(videoPlayerState);
  useEffect(() => {
    videoPlayerStateRef.current = videoPlayerState;
  }, [videoPlayerState]);

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
          metricsAccumulator: metricsAccumulatorRef.current ?? undefined,
        },
        videoPlayerStateRef.current
      );
    },
    [clearOverlayTimer]
  );

  const setVideoElement = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement;
    if (videoElement) {
      metricsAccumulatorRef.current = createVideoSessionMetrics();
      setVideoPlayerState((prev) => ({ ...prev, isVideoLoading: true }));
    }
  }, []);

  const pauseVideoOnBargeIn = useCallback(() => {
    pauseVideoElementOnBargeIn(videoElementRef.current, {
      setVideoPlayerState,
      metricsAccumulator: metricsAccumulatorRef.current ?? undefined,
    });
  }, []);

  const handleVideoLoadStateChange = useCallback(
    (isLoading: boolean) => {
      if (!isLoading && videoElementRef.current && metricsAccumulatorRef.current) {
        const videoDuration = videoElementRef.current.duration;
        if (Number.isFinite(videoDuration) && videoDuration > 0) {
          metricsAccumulatorRef.current.setVideoDurationSeconds(videoDuration);
        }
      }
      setVideoPlayerState((prev) => ({ ...prev, isVideoLoading: isLoading }));
    },
    []
  );

  const handleVideoEnded = useCallback(() => {
    metricsAccumulatorRef.current?.recordPlayStopped();
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
    if (metricsAccumulatorRef.current) {
      metricsAccumulatorRef.current.recordPlayStopped();
      console.info(
        JSON.stringify(metricsAccumulatorRef.current.toSummaryLog())
      );
      metricsAccumulatorRef.current = null;
    }
    clearOverlayTimer();
    resetVideoElement(videoElementRef.current);
    setVideoPlayerState({
      ...INITIAL_VIDEO_PLAYER_STATE,
      isVideoLoading: false,
    });
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
