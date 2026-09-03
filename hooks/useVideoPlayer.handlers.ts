import type { VideoFunctionName } from "@/lib/deepgram/function-call-types";

export interface VideoPlayerState {
  isVideoPlaying: boolean;
  videoPlaybackSpeed: number;
  videoOverlayText: string;
  isVideoLoading: boolean;
  isVideoEnded: boolean;
}

export const INITIAL_VIDEO_PLAYER_STATE: VideoPlayerState = {
  isVideoPlaying: false,
  videoPlaybackSpeed: 1,
  videoOverlayText: "",
  isVideoLoading: true,
  isVideoEnded: false,
};

export const ALLOWED_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
export const DEFAULT_OVERLAY_DURATION_SECONDS = 5;

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
}

export function dispatchVideoFunctionCall(
  videoElement: HTMLVideoElement | null,
  functionName: string,
  argumentsJson: string,
  callbacks: VideoFunctionCallbacks
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
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: true,
        isVideoEnded: false,
      }));
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
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: false,
      }));
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
      callbacks.setVideoPlayerState((prev) => ({
        ...prev,
        isVideoPlaying: true,
        isVideoEnded: false,
      }));
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
  callbacks: Pick<VideoFunctionCallbacks, "setVideoPlayerState">
): void {
  if (!videoElement || videoElement.paused) return;

  videoElement.pause();
  callbacks.setVideoPlayerState((prev) => ({
    ...prev,
    isVideoPlaying: false,
  }));
  console.info(
    JSON.stringify({
      level: "info",
      component: "use_video_player",
      event: "video_paused_on_barge_in",
      payload: { currentTime: videoElement.currentTime },
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
