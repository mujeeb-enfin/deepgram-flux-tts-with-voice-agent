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
 *
 * Prefers AudioWorkletNode (audio-thread processing, immune to main-thread
 * jank). Falls back to ScriptProcessorNode when the worklet fails to load
 * (old browser, CSP restriction, module error).
 */
export function useMicrophone(sendAudioChunk: (buffer: ArrayBuffer) => void) {
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const isUsingWorkletRef = useRef(false);
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
      sourceNode.connect(analyserNode);

      micStreamRef.current = mediaStream;
      micAnalyserRef.current = analyserNode;

      const contextSampleRate = audioContext.sampleRate;
      let workletLoaded = false;

      if (typeof audioContext.audioWorklet !== "undefined") {
        try {
          await audioContext.audioWorklet.addModule("/mic-worklet-processor.js");
          const workletNode = new AudioWorkletNode(
            audioContext,
            "mic-worklet-processor"
          );
          workletNode.port.onmessage = (messageEvent: MessageEvent) => {
            if (messageEvent.data.type === "audio") {
              const wireReady = resampleMonoFloat32ToWireRateInt16(
                messageEvent.data.samples as Float32Array,
                contextSampleRate,
                DEEPGRAM_WIRE_INPUT_SAMPLE_RATE
              );
              sendAudioChunk(wireReady.buffer as ArrayBuffer);
            }
          };
          workletNode.port.postMessage({
            type: "mute",
            value: isMicMutedRef.current,
          });
          workletNode.port.postMessage({
            type: "suppress",
            value: isMicSuppressedRef.current,
          });
          analyserNode.connect(workletNode);
          workletNode.connect(audioContext.destination);
          micWorkletNodeRef.current = workletNode;
          isUsingWorkletRef.current = true;
          workletLoaded = true;
          console.info(
            JSON.stringify({
              level: "info",
              component: "use_microphone",
              event: "audio_worklet_loaded",
            })
          );
        } catch (workletLoadError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              component: "use_microphone",
              event: "audio_worklet_fallback",
              payload: { error: String(workletLoadError) },
            })
          );
        }
      }

      if (!workletLoaded) {
        const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
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
        analyserNode.connect(processorNode);
        processorNode.connect(audioContext.destination);
        micProcessorRef.current = processorNode;
        isUsingWorkletRef.current = false;
      }
    },
    [sendAudioChunk]
  );

  const stopMic = useCallback(() => {
    if (micWorkletNodeRef.current) {
      micWorkletNodeRef.current.disconnect();
      micWorkletNodeRef.current.port.close();
      micWorkletNodeRef.current = null;
    }
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
    isUsingWorkletRef.current = false;
  }, []);

  const toggleMicMute = useCallback(() => {
    setIsMicMuted((prev) => {
      const next = !prev;
      isMicMutedRef.current = next;
      if (micWorkletNodeRef.current) {
        micWorkletNodeRef.current.port.postMessage({
          type: "mute",
          value: next,
        });
      }
      return next;
    });
  }, []);

  const setMicSuppressed = useCallback((suppressed: boolean) => {
    isMicSuppressedRef.current = suppressed;
    if (micWorkletNodeRef.current) {
      micWorkletNodeRef.current.port.postMessage({
        type: "suppress",
        value: suppressed,
      });
    }
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
