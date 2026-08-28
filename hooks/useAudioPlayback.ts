"use client";

import { useRef, useCallback } from "react";

const OUTPUT_SAMPLE_RATE = 24000;

export function useAudioPlayback() {
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackGainRef = useRef<GainNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackHeadRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const initPlayback = useCallback(() => {
    const audioContext = new AudioContext();
    const gainNode = audioContext.createGain();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    gainNode.connect(analyserNode);
    analyserNode.connect(audioContext.destination);
    playbackContextRef.current = audioContext;
    playbackGainRef.current = gainNode;
    playbackAnalyserRef.current = analyserNode;
    playbackHeadRef.current = 0;
    activeSourcesRef.current = [];
  }, []);

  const queueAudio = useCallback((rawBuffer: ArrayBuffer) => {
    const audioContext = playbackContextRef.current;
    const gainNode = playbackGainRef.current;
    if (!audioContext || !gainNode) return;

    const pcmSamples = new Int16Array(rawBuffer);
    if (!pcmSamples.length) return;

    const audioBuffer = audioContext.createBuffer(1, pcmSamples.length, OUTPUT_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcmSamples.length; i++) {
      channelData[i] = pcmSamples[i] / 32768;
    }

    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(gainNode);

    const currentTime = audioContext.currentTime;
    if (playbackHeadRef.current < currentTime) {
      playbackHeadRef.current = currentTime + 0.04;
    }
    sourceNode.start(playbackHeadRef.current);
    playbackHeadRef.current += audioBuffer.duration;

    activeSourcesRef.current.push(sourceNode);
    sourceNode.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== sourceNode);
    };
  }, []);

  const stopPlayback = useCallback((): boolean => {
    const audioContext = playbackContextRef.current;
    const hadQueuedAudio =
      activeSourcesRef.current.length > 0 ||
      (audioContext !== null && playbackHeadRef.current > audioContext.currentTime);

    activeSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch { /* already stopped */ }
    });
    activeSourcesRef.current = [];
    playbackHeadRef.current = audioContext ? audioContext.currentTime : 0;
    return hadQueuedAudio;
  }, []);

  const destroyPlayback = useCallback(() => {
    stopPlayback();
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    playbackGainRef.current = null;
    playbackAnalyserRef.current = null;
  }, [stopPlayback]);

  return {
    playbackAnalyserRef,
    initPlayback,
    queueAudio,
    stopPlayback,
    destroyPlayback,
  };
}
