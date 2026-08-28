"use client";

import { useRef, useCallback, useState } from "react";

const INPUT_SAMPLE_RATE = 16000;

export function useMicrophone(sendAudioChunk: (buffer: ArrayBuffer) => void) {
  const micContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isMicMutedRef = useRef(false);
  const isMicSuppressedRef = useRef(false);

  const startMic = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const audioContext = new AudioContext();
    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 256;
    const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    const inputSampleRate = audioContext.sampleRate;
    const resampleRatio = INPUT_SAMPLE_RATE / inputSampleRate;

    processorNode.onaudioprocess = (event) => {
      if (isMicMutedRef.current || isMicSuppressedRef.current) return;
      const floatSamples = event.inputBuffer.getChannelData(0);
      const outputLength = Math.floor(floatSamples.length * resampleRatio);
      const int16Samples = new Int16Array(outputLength);
      for (let i = 0; i < outputLength; i++) {
        const sourceIndex = i / resampleRatio;
        const lowerIndex = Math.floor(sourceIndex);
        const upperIndex = Math.min(lowerIndex + 1, floatSamples.length - 1);
        const fraction = sourceIndex - lowerIndex;
        const interpolated = floatSamples[lowerIndex] * (1 - fraction) + floatSamples[upperIndex] * fraction;
        const clamped = Math.max(-1, Math.min(1, interpolated));
        int16Samples[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
      }
      sendAudioChunk(int16Samples.buffer);
    };

    sourceNode.connect(analyserNode);
    analyserNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    micContextRef.current = audioContext;
    micStreamRef.current = mediaStream;
    micProcessorRef.current = processorNode;
    micAnalyserRef.current = analyserNode;
  }, [sendAudioChunk]);

  const stopMic = useCallback(() => {
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current.onaudioprocess = null;
      micProcessorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (micContextRef.current) {
      micContextRef.current.close();
      micContextRef.current = null;
    }
    micAnalyserRef.current = null;
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
