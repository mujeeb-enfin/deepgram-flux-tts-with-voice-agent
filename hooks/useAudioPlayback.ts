"use client";

import { useRef, useCallback } from "react";
import {
  DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE,
  type AudioBufferLike,
  type AudioBufferSourceNodeLike,
  type AudioContextLike,
} from "@/lib/audio/sample-rate";
import {
  computeScheduleAt,
  createScheduleState,
  hasQueuedAudio,
  registerBufferSource,
  removeBufferSource,
  updateScheduledEnd,
  type ScheduleState,
} from "@/lib/audio/schedule-tracker";

/**
 * Playback receives Deepgram's 24kHz linear16 PCM and schedules it back-to-back
 * on the host's AudioContext. The context is owned by the caller (FluxAgentBench)
 * so the mic and the speakers share one graph — that is what makes the browser's
 * echoCancellation effective.
 */
export function useAudioPlayback() {
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackGainRef = useRef<GainNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const scheduleStateRef = useRef<ScheduleState>(createScheduleState());

  const initPlayback = useCallback((audioContext: AudioContext) => {
    const gainNode = audioContext.createGain();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    playbackContextRef.current = audioContext;
    playbackGainRef.current = gainNode;
    playbackAnalyserRef.current = analyserNode;
    scheduleStateRef.current = createScheduleState();
  }, []);

  const queueAudio = useCallback((rawBuffer: ArrayBuffer) => {
    const audioContext = playbackContextRef.current;
    const gainNode = playbackGainRef.current;
    if (!audioContext || !gainNode) return;

    const pcmSamples = new Int16Array(rawBuffer);
    if (!pcmSamples.length) return;

    const audioBuffer = audioContext.createBuffer(
      1,
      pcmSamples.length,
      DEEPGRAM_WIRE_OUTPUT_SAMPLE_RATE
    );
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmSamples.length; i++) {
      channelData[i] = pcmSamples[i] / 32768;
    }

    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);

    const audioContextLike: AudioContextLike = audioContext as unknown as AudioContextLike;
    const scheduleState = scheduleStateRef.current;
    const scheduleAt = computeScheduleAt(
      audioContextLike.currentTime,
      scheduleState.lastQueuedEndRef.current
    );
    const sourceNodeLike = sourceNode as unknown as AudioBufferSourceNodeLike;
    sourceNodeLike.start(scheduleAt);
    const audioBufferLike = audioBuffer as unknown as AudioBufferLike;
    updateScheduledEnd(scheduleState, scheduleAt + audioBufferLike.duration);

    registerBufferSource(scheduleState, sourceNode);
    sourceNode.onended = () => {
      removeBufferSource(scheduleState, sourceNode);
    };
  }, []);

  const stopPlayback = useCallback((): boolean => {
    const audioContext = playbackContextRef.current;
    const scheduleState = scheduleStateRef.current;
    const hadQueuedAudio = hasQueuedAudio(
      scheduleState,
      (audioContext as unknown as AudioContextLike)?.currentTime ?? 0
    );

    let alreadyStoppedSourceCount = 0;
    scheduleState.activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        alreadyStoppedSourceCount++;
      }
    });
    if (alreadyStoppedSourceCount > 0) {
      console.info(
        JSON.stringify({
          level: "info",
          component: "use_audio_playback",
          event: "stop_playback_already_stopped",
          payload: { count: alreadyStoppedSourceCount },
        })
      );
    }
    scheduleStateRef.current = createScheduleState();
    return hadQueuedAudio;
  }, []);

  const destroyPlayback = useCallback(() => {
    stopPlayback();
    if (playbackGainRef.current) {
      playbackGainRef.current.disconnect();
      playbackGainRef.current = null;
    }
    if (playbackAnalyserRef.current) {
      playbackAnalyserRef.current.disconnect();
      playbackAnalyserRef.current = null;
    }
    playbackContextRef.current = null;
  }, [stopPlayback]);

  return {
    playbackAnalyserRef,
    initPlayback,
    queueAudio,
    stopPlayback,
    destroyPlayback,
  };
}