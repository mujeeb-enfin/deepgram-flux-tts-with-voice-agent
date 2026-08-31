"use client";

import { useRef, useCallback, useState } from "react";
import {
  DEEPGRAM_WIRE_INPUT_SAMPLE_RATE,
  resampleMonoFloat32ToWireRateInt16,
} from "@/lib/audio/sample-rate";

/**
 * Mic capture runs on the host's AudioContext (shared with playback) and
 * downsamples its native rate to Deepgram's 16kHz wire rate. It exercises a
 * single layer of echo cancellation (getUserMedia) instead of faking one.
 */
export function useMicrophone(sendAudioChunk: (buffer: ArrayBuffer) => void) {
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isMicMutedRef = useRef(false);
  const isMicSuppressedRef = useRef(false);

  const startMic = useCallback(
    async (audioContext: AudioContext) => {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      const sourceNode = audioContext.createMediaStreamSource(mediaStream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

      const contextSampleRate = audioContext.sampleRate;
      processorNode.onaudioprocess = (event) => {
        if (isMicMutedRef.current || isMicSuppressedRef.current) return;
        const floatSamples = event.inputBuffer.getChannelData(0);
        const wireReady = resampleMonoFloat32ToWireRateInt16(
          floatSamples,
          contextSampleRate,
          DEEPGRAM_WIRE_INPUT_SAMPLE_RATE
        );
        sendAudioChunk(wireReady.buffer as ArrayBuffer);
      };

      sourceNode.connect(analyserNode);
      analyserNode.connect(processorNode);
      processorNode.connect(audioContext.destination);

      micStreamRef.current = mediaStream;
      micProcessorRef.current = processorNode;
      micAnalyserRef.current = analyserNode;
    },
    [sendAudioChunk]
  );

  const stopMic = useCallback(() => {
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current.onaudioprocess = null;
      micProcessorRef.current = null;
    }
    if (micAnalyserRef.current) {
      micAnalyserRef.current.disconnect();
      micAnalyserRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  }, []);

  const toggleMicMute = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      isMicMutedRef.current = next;
      return next;
    });
  }, []);

  const setMicSuppressed = useCallback((suppressed: boolean) => {
    isMicSuppressedRef.current = suppressed;
  }, []);

  return {
    micAnalyserRef,
    isMicMuted,
    isMicMutedRef,
    startMic,
    stopMic,
    toggleMicMute,
    setMicSuppressed,
  };
}