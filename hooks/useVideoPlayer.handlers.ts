import type { VideoFunctionName } from "@/lib/deepgram/function-call-types";
import type { VideoSessionMetricsAccumulator } from "@/lib/video/session-metrics";

export interface VideoPlayerState {
  isVideoPlaying: boolean;
  videoPlaybackSpeed: number;
  videoOverlayText: string;
  isVideoLoading: boolean;
  isVideoEnded: boolean;
  wasPausedByBargeIn: boolean;
  lastNarratedChapterTimestampSeconds: number | null;
  lastPausedAtSeconds: number | null;
}

export const INITIAL_VIDEO_PLAYER_STATE: VideoPlayerState = {
  isVideoPlaying: false,
  videoPlaybackSpeed: 1,
  videoOverlayText: "",
  isVideoLoading: true,
  isVideoEnded: false,
  wasPausedByBargeIn: false,
  lastNarratedChapterTimestampSeconds: null,
  lastPausedAtSeconds: null,
};

export const ALLOWED_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
export const DEFAULT_OVERLAY_DURATION_SECONDS = 5;
export const RESUME_CONFIRMATION_TEXT = "Resuming demo...";
export const RESUME_CONFIRMATION_DURATION_MS = 2000;

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

export interface VideoFunctionCallbacks {
  setVideoPlayerState: (
    updater: (prev: VideoPlayerState) => VideoPlayerState
  ) => void;
  clearOverlayTimer: () => void;
  setOverlayTimer: (timer: ReturnType<typeof setTimeout>) => void;
  metricsAccumulator?: VideoSessionMetricsAccumulator;
}

export function dispatchVideoFunctionCall(
  videoElement: HTMLVideoElement | null,
  functionName: string,
  argumentsJson: string,
  callbacks: VideoFunctionCallbacks,
  currentState: VideoPlayerState
): string {
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
      const seekArguments =
        parsedArguments as unknown as SeekAndPlayArguments;
      const targetTimestamp = Number(seekArguments.timestamp_seconds);
      if (isNaN(targetTimestamp) || targetTimestamp < 0) {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "use_video_player",
            event: "video_seek_invalid_timestamp",
            payload: {
              rawTimestamp: seekArguments.timestamp_seconds,
              functionName,
            },
          })
        );
        return `Invalid timestamp: ${seekArguments.timestamp_seconds}`;
      }
      const clampedTimestamp = Math.min(
        targetTimestamp,
        videoElement.duration || Infinity
      );
      videoElement.currentTime = clampedTimestamp;
      videoElement.play().catch((videoPlayError) => {
        callbacks.setVideoPlayerState((prev) => ({
          ...prev,
          isVideoPlaying: false,
        }));
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "use_video_player",
            event: "video_play_failed",
            payload: { error: String(videoPlayError) },
          })
        );
      });
      if (currentState.wasPausedByBargeIn) {
        callbacks.clearOverlayTimer();
        callbacks.setOverlayTimer(
          setTimeout(() => {
            callbacks.setVideoPlayerState((prev) => ({
              ...prev,
              videoOverlayText: "",
            }));
          }, RESUME_CONFIRMATION_DURATION_MS)
        );
      }
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: true,
        isVideoEnded: false,
        wasPausedByBargeIn: false,
        lastNarratedChapterTimestampSeconds: clampedTimestamp,
        lastPausedAtSeconds: null,
        ...(currentState.wasPausedByBargeIn
          ? { videoOverlayText: RESUME_CONFIRMATION_TEXT }
          : {}),
      }));
      callbacks.metricsAccumulator?.recordChapterSeek(clampedTimestamp);
      callbacks.metricsAccumulator?.recordPlayStarted();
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
      const pausedAtCurrentTime = videoElement.currentTime;
      videoElement.pause();
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: false,
        wasPausedByBargeIn: false,
        lastPausedAtSeconds: pausedAtCurrentTime,
      }));
      callbacks.metricsAccumulator?.recordPlayStopped();
      console.info(
        JSON.stringify({
          level: "info",
          component: "use_video_player",
          event: "video_paused",
          payload: { currentTime: pausedAtCurrentTime },
        })
      );
      const lastChapterContext =
        currentState.lastNarratedChapterTimestampSeconds !== null
          ? ` Last narrated chapter started at ${Math.round(currentState.lastNarratedChapterTimestampSeconds)} seconds.`
          : "";
      return `Video paused at ${Math.round(pausedAtCurrentTime)} seconds.${lastChapterContext}`;
    }

    case "resume_video": {
      const resumeFromTime = videoElement.currentTime;
      videoElement.play().catch((videoResumeError) => {
        callbacks.setVideoPlayerState((prev) => ({
          ...prev,
          isVideoPlaying: false,
        }));
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "use_video_player",
            event: "video_resume_failed",
            payload: { error: String(videoResumeError) },
          })
        );
      });
      if (currentState.wasPausedByBargeIn) {
        callbacks.clearOverlayTimer();
        callbacks.setOverlayTimer(
          setTimeout(() => {
            callbacks.setVideoPlayerState((prev) => ({
              ...prev,
              videoOverlayText: "",
            }));
          }, RESUME_CONFIRMATION_DURATION_MS)
        );
      }
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: true,
        isVideoEnded: false,
        wasPausedByBargeIn: false,
        lastPausedAtSeconds: null,
        ...(currentState.wasPausedByBargeIn
          ? { videoOverlayText: RESUME_CONFIRMATION_TEXT }
          : {}),
      }));
      callbacks.metricsAccumulator?.recordPlayStarted();
      console.info(
        JSON.stringify({
          level: "info",
          component: "use_video_player",
          event: "video_resumed",
          payload: { currentTime: resumeFromTime },
        })
      );
      const lastChapterResumeContext =
        currentState.lastNarratedChapterTimestampSeconds !== null
          ? ` Last narrated chapter was at ${Math.round(currentState.lastNarratedChapterTimestampSeconds)} seconds.`
          : "";
      return `Video resumed from ${Math.round(resumeFromTime)} seconds.${lastChapterResumeContext}`;
    }

    case "set_playback_speed": {
      const speedArguments =
        parsedArguments as unknown as SetPlaybackSpeedArguments;
      const requestedSpeed = Number(speedArguments.speed);
      if (
        !(ALLOWED_PLAYBACK_SPEEDS as readonly number[]).includes(
          requestedSpeed
        )
      ) {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "use_video_player",
            event: "video_speed_invalid",
            payload: {
              rawSpeed: speedArguments.speed,
              allowedSpeeds: ALLOWED_PLAYBACK_SPEEDS,
            },
          })
        );
        return `Invalid speed: ${speedArguments.speed}. Allowed: ${ALLOWED_PLAYBACK_SPEEDS.join(", ")}`;
      }
      videoElement.playbackRate = requestedSpeed;
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        videoPlaybackSpeed: requestedSpeed,
      }));
      callbacks.metricsAccumulator?.recordSpeedChange(requestedSpeed);
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
      const overlayArguments =
        parsedArguments as unknown as ShowOverlayTextArguments;
      const overlayText = String(overlayArguments.text || "");
      const overlayDurationSeconds =
        Number(overlayArguments.duration_seconds) ||
        DEFAULT_OVERLAY_DURATION_SECONDS;

      callbacks.clearOverlayTimer();
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        videoOverlayText: overlayText,
      }));
      callbacks.setOverlayTimer(
        setTimeout(() => {
          callbacks.setVideoPlayerState((prev) => ({
            ...prev,
            videoOverlayText: "",
          }));
        }, overlayDurationSeconds * 1000)
      );

      callbacks.metricsAccumulator?.recordOverlayText(overlayText);
      console.info(
        JSON.stringify({
          level: "info",
          component: "use_video_player",
          event: "video_overlay_shown",
          payload: {
            text: overlayText,
            durationSeconds: overlayDurationSeconds,
          },
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
}

export function pauseVideoElementOnBargeIn(
  videoElement: HTMLVideoElement | null,
  callbacks: Pick<VideoFunctionCallbacks, "setVideoPlayerState" | "metricsAccumulator">
): void {
  if (!videoElement || videoElement.paused) return;

  const bargeInPauseTime = videoElement.currentTime;
  videoElement.pause();
  callbacks.setVideoPlayerState((prev) => ({
    ...prev,
    isVideoPlaying: false,
    wasPausedByBargeIn: true,
    lastPausedAtSeconds: bargeInPauseTime,
  }));
  callbacks.metricsAccumulator?.recordBargeInPause(bargeInPauseTime);
  callbacks.metricsAccumulator?.recordPlayStopped();
  console.info(
    JSON.stringify({
      level: "info",
      component: "use_video_player",
      event: "video_paused_on_barge_in",
      payload: { currentTime: bargeInPauseTime },
    })
  );
}

export function resetVideoElement(videoElement: HTMLVideoElement | null): void {
  if (videoElement) {
    videoElement.pause();
    videoElement.currentTime = 0;
    videoElement.playbackRate = 1;
  }
}
