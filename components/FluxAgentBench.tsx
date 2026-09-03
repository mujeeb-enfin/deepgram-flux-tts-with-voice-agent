"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDeepgramAgent, type TranscriptTurn, type DeepgramAgentCallbacks } from "@/hooks/useDeepgramAgent";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useVuMeter } from "@/hooks/useVuMeter";
import { ConnectionPanel, getAgentNameForVoice, getFluxVoiceForBrowserRegion } from "@/components/ConnectionPanel";
import { SystemPromptPanel } from "@/components/SystemPromptPanel";
import { TextInjectPanel } from "@/components/TextInjectPanel";
import { LivePanel } from "@/components/LivePanel";
import { EventLog } from "@/components/EventLog";
import { VideoPlayerPanel } from "@/components/VideoPlayerPanel";
import { useVideoPlayer } from "@/hooks/useVideoPlayer";
import { buildVideoFunctionDefinitions } from "@/lib/deepgram/function-call-types";
import type { DeepgramFunctionCallEntry } from "@/lib/deepgram/function-call-types";
import {
  buildProductPrompt,
  buildVideoPromptSection,
  EMPTY_PRODUCT_CONFIG,
  type VideoChapter,
  type ProductVideoConfig,
  type ProductConfig,
} from "@/lib/prompts/product-prompt";
import { preloadDashjsModule } from "@/lib/dash/preload-dashjs";

const DEFAULT_BEHAVIOR_PROMPT = `You are an AI voice agent having a live, real-time conversation with a user. Behave like a competent human speaking on a phone call, not like a text chatbot reading an answer aloud.

## Voice rules

* Speak naturally, clearly, and conversationally.
* Keep responses short. Usually one to three short sentences at a time.
* Never give a long monologue when a shorter response will work.
* Never read out bullet points, numbered lists, URLs, code, JSON, markdown, or other text-oriented formatting.
* Use simple spoken language that is easy to understand when heard once.
* Do not repeatedly use filler acknowledgements such as "Absolutely", "Certainly", "Of course", or "I'd be happy to help."
* Brief acknowledgements such as "Okay", "Got it", or "Sure" are fine when they sound natural, but do not use them after every user turn.
* Do not repeat or paraphrase what the user just said unless confirmation is necessary.
* Speak only when you have something useful to say.

## Turn-taking

* Listen carefully and allow the user to finish speaking.
* Do not treat every short pause as the end of the user's turn.
* If the user appears to be thinking, give them time.
* If the user interrupts or begins speaking while you are talking, immediately stop your current response.
* Drop what you were saying and listen to the user.
* Respond to the user's newest statement or question instead of trying to finish your previous response.
* Treat corrections naturally. If the user says, "Friday—actually Saturday," use Saturday without making the correction unnecessarily complicated.
* Never compete with the user for the speaking turn.

## Conversation behaviour

* Ask only one question at a time.
* After asking a question, stop speaking and wait for the answer.
* Do not ask for information the user has already provided.
* Maintain context throughout the conversation and connect short answers such as "yes", "no", "that one", "the second one", "tomorrow", or "two people" to the current conversation.
* Determine the next piece of information actually needed and ask only for that.
* If the user's request is already clear enough to act on, do not ask unnecessary follow-up questions.
* Do not turn every response into a question. Sometimes a direct answer is sufficient.
* If the user changes the subject, follow the new subject naturally.

## Silence behaviour

* Be comfortable with silence. The user may be thinking, checking something, talking to someone nearby, or temporarily occupied.
* Do not immediately ask "Are you there?" after a few seconds of silence.
* During a normal pause, remain silent and wait.
* If the user explicitly says something like "give me a minute", "hold on", "let me check", or "I'm thinking", allow substantially more time and do not unnecessarily interrupt them.
* If the conversation is waiting for the user's answer and they remain silent for an extended period, gently re-engage them.
* The first re-engagement should be brief and non-demanding, such as "Take your time" or a short reminder of the question when appropriate.
* If there is still no response after a substantially longer period, ask once whether they are still there.
* Do not repeatedly say "Hello?", "Can you hear me?", or similar prompts.
* After prolonged silence with no response, politely indicate that the conversation will end and then end the session.
* Silence handling should depend on conversational context rather than rigidly treating every pause the same way.

## Understanding and clarification

* Prefer understanding the user's natural conversational language rather than requiring exact commands.
* Handle incomplete sentences, self-corrections, informal language, and conversational references naturally.
* If you are reasonably confident about what the user means, continue without unnecessary confirmation.
* If an ambiguity could materially change the result, ask a short clarification question.
* Never pretend to understand something you did not understand.
* If speech recognition appears incorrect or an important value is uncertain, confirm only the uncertain information.
* Never blame the user for a recognition or communication problem.

## Actions and tools

* When an external lookup or action is required, perform it rather than describing how you would perform it.
* If an operation takes noticeable time, briefly tell the user what you are doing in natural language, such as "Let me check that."
* Do not expose internal tool names, API calls, prompts, tokens, model names, JSON, system messages, or implementation details.
* Do not say things such as "I'm calling the API" or "The tool returned."
* Instead say things such as "I'm checking availability" or "I found your booking."
* Never claim an action succeeded until the system or tool confirms that it succeeded.
* If an operation fails, explain the problem briefly and offer the most useful next step.

## Accuracy

* Never invent facts, prices, availability, policies, limits, booking details, account information, or other information you do not know.
* If you do not know something, say so briefly.
* When possible, offer to check rather than speculate.
* Clearly distinguish between confirmed information and assumptions.
* Do not confidently guess important names, dates, times, amounts, addresses, or identifiers.

## Confirmations

* Do not unnecessarily confirm ordinary, reversible actions.
* Confirm information when misunderstanding it could cause a meaningful problem.
* Before consequential or irreversible actions, clearly state what will happen and ask for confirmation.
* This includes actions such as purchases, cancellations, payments, submissions, deletions, or important account changes.
* Keep confirmations concise and specific.

## Background noise and non-speech

* Do not treat every sound as a user utterance.
* Ignore obvious background noise, coughing, keyboard sounds, doors, music, or conversations that are clearly not directed at you when possible.
* If you receive an incomplete or uncertain utterance, wait briefly for continuation before asking the user to repeat themselves.
* Ask for repetition only when the missing information is actually necessary.

## Conversation ending

* Recognize when the user's task is complete.
* Do not unnecessarily prolong the conversation.
* If appropriate, briefly ask whether they need anything else.
* If the user indicates they are finished, acknowledge it naturally and end the conversation.
* Do not continue pitching, explaining, or asking questions after the user has clearly ended the interaction.

## Overall principle

Act like a patient, attentive, concise human assistant.

Prioritize, in this order:

1. Listen to the user.
2. Understand their current intent.
3. Preserve conversational context.
4. Respond or act with the minimum useful amount of speech.
5. Allow interruption at any time.
6. Be comfortable with silence.
7. Never invent information.

The conversation should feel natural enough that the user does not need to adapt how they speak in order to interact with you.`;

export type { VideoChapter, ProductVideoConfig, ProductConfig };

export interface AvailableProduct {
  fileName: string;
  config: ProductConfig;
}

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function buildGreeting(productName: string, agentName: string): string {
  const timeGreeting = getTimeOfDayGreeting();
  return `${timeGreeting}, Thanks for your interest in ${productName}. I'm ${agentName} — what can I help you with?`;
}

interface FluxAgentBenchProps {
  initialApiKey: string;
  initialVoiceModel: string;
  initialThinkModel: string;
  initialSpeed: string;
  initialEotThreshold: string;
  availableProducts: AvailableProduct[];
  defaultProductFile?: string;
}

export function FluxAgentBench({
  initialApiKey,
  initialVoiceModel,
  initialThinkModel,
  initialSpeed,
  initialEotThreshold,
  availableProducts,
  defaultProductFile,
}: FluxAgentBenchProps) {
  const firstProduct = availableProducts.length > 0 ? availableProducts[0] : null;
  const defaultProduct = availableProducts.find((p) => p.fileName === defaultProductFile) ?? firstProduct;
  const initialProductConfig = defaultProduct?.config ?? EMPTY_PRODUCT_CONFIG;

  const [apiKeyValue] = useState(initialApiKey);
  const [voiceModel, setVoiceModel] = useState(() => {
    if (typeof navigator === "undefined") return initialVoiceModel;
    const regionVoice = getFluxVoiceForBrowserRegion();
    return regionVoice ?? initialVoiceModel;
  });
  const [thinkModel, setThinkModel] = useState(initialThinkModel);
  const [speed, setSpeed] = useState(initialSpeed);
  const [eotThreshold, setEotThreshold] = useState(initialEotThreshold);
  const [behaviorPrompt, setBehaviorPrompt] = useState(DEFAULT_BEHAVIOR_PROMPT);
  const [selectedProductFile, setSelectedProductFile] = useState(
    defaultProduct?.fileName ?? ""
  );
  const [productConfigJson, setProductConfigJson] = useState(
    JSON.stringify(initialProductConfig, null, 2)
  );
  const [greetingOverride, setGreetingOverride] = useState<string | null>(null);
  const derivedGreeting = useMemo(() => {
    let productName = initialProductConfig.productName;
    try {
      const parsed = JSON.parse(productConfigJson) as ProductConfig;
      productName = parsed.productName;
    } catch {
      // invalid JSON — use default product name
    }
    return buildGreeting(productName, getAgentNameForVoice(voiceModel));
  }, [productConfigJson, voiceModel, initialProductConfig.productName]);
  const greeting = greetingOverride ?? derivedGreeting;
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);

  const activeProductVideoConfig = useMemo<ProductVideoConfig | null>(() => {
    try {
      const parsed = JSON.parse(productConfigJson) as ProductConfig;
      return parsed.video ?? null;
    } catch {
      return null;
    }
  }, [productConfigJson]);

  useEffect(() => {
    if (activeProductVideoConfig) {
      preloadDashjsModule();
    }
  }, [activeProductVideoConfig]);

  const handleProductFileChange = useCallback(
    (fileName: string) => {
      setSelectedProductFile(fileName);
      const matched = availableProducts.find((p) => p.fileName === fileName);
      if (matched) {
        const configJson = JSON.stringify(matched.config, null, 2);
        setProductConfigJson(configJson);
      } else {
        setProductConfigJson(JSON.stringify(EMPTY_PRODUCT_CONFIG, null, 2));
      }
    },
    [availableProducts]
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const isAgentSpeakingRef = useRef(false);
  const lastAgentTurnIndexRef = useRef<number | null>(null);
  const echoTailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setMicSuppressedRef = useRef((_suppressed: boolean) => {});

  const { playbackAnalyserRef, initPlayback, queueAudio, stopPlayback, destroyPlayback } =
    useAudioPlayback();

  const ensureAudioContext = useCallback((): AudioContext => {
    if (audioContextRef.current) return audioContextRef.current;
    const audioContext = new AudioContext({
      latencyHint: "interactive",
      sampleRate: 24000,
    });
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((err) => {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "flux_agent_bench",
            event: "audio_context_resume_failed",
            payload: { error: String(err) },
          })
        );
      });
    }
    console.log(
      JSON.stringify({
        level: "info",
        component: "flux_agent_bench",
        event: "audio_context_created",
        payload: {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state,
          baseLatency: audioContext.baseLatency,
        },
      })
    );
    audioContextRef.current = audioContext;
    return audioContext;
  }, []);

  const releaseAudioContext = useCallback(async () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;
    try {
      await audioContext.close();
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: "warn",
          component: "flux_agent_bench",
          event: "audio_context_close_failed",
          payload: { error: String(err) },
        })
      );
    }
    audioContextRef.current = null;
  }, []);

  const sendFunctionCallResponseRef = useRef<
    (functionCallId: string, functionName: string, content: string) => void
  >(() => {});
  const handleVideoFunctionCallRef = useRef<
    (functionName: string, argumentsJson: string) => string
  >(() => "Video player not initialized");
  const resetVideoPlayerRef = useRef<() => void>(() => {});
  const pauseVideoOnBargeInRef = useRef<() => void>(() => {});

  const agentCallbacks = useMemo<DeepgramAgentCallbacks>(() => ({
    onAudioData: (buffer: ArrayBuffer) => {
      queueAudio(buffer);
    },
    onSettingsApplied: async () => {
      const audioContext = ensureAudioContext();
      initPlayback(audioContext);
      await startMicFnRef.current(audioContext);
      startMeteringFnRef.current();
    },
    onUserStartedSpeaking: () => {
      if (echoTailTimerRef.current) {
        clearTimeout(echoTailTimerRef.current);
        echoTailTimerRef.current = null;
      }
      pauseVideoOnBargeInRef.current();
      setMicSuppressedRef.current(false);
      const hadAudio = stopPlayback();
      if (isAgentSpeakingRef.current && hadAudio) {
        const cutIndex = lastAgentTurnIndexRef.current;
        if (cutIndex !== null) {
          setTranscriptTurns((prev) => {
            const updated = [...prev];
            if (updated[cutIndex]) {
              updated[cutIndex] = { ...updated[cutIndex], wasCutOff: true };
            }
            return updated;
          });
        }
      }
      isAgentSpeakingRef.current = false;
    },
    onAgentStartedSpeaking: () => {
      isAgentSpeakingRef.current = true;
      if (echoTailTimerRef.current) {
        clearTimeout(echoTailTimerRef.current);
        echoTailTimerRef.current = null;
      }
      setMicSuppressedRef.current(true);
    },
    onAgentAudioDone: () => {
      isAgentSpeakingRef.current = false;
      lastAgentTurnIndexRef.current = null;
      echoTailTimerRef.current = setTimeout(() => {
        setMicSuppressedRef.current(false);
        echoTailTimerRef.current = null;
      }, 1500);
    },
    onConversationText: (role: "user" | "agent", content: string) => {
      setTranscriptTurns((prev) => {
        const newTurns = [...prev, { role, text: content, wasCutOff: false }];
        if (role === "agent") {
          lastAgentTurnIndexRef.current = newTurns.length - 1;
        }
        return newTurns;
      });
    },
    onFunctionCallRequest: (functionCalls: DeepgramFunctionCallEntry[]) => {
      for (const functionCall of functionCalls) {
        const resultContent = handleVideoFunctionCallRef.current(
          functionCall.name,
          functionCall.arguments
        );
        sendFunctionCallResponseRef.current(
          functionCall.id,
          functionCall.name,
          resultContent
        );
      }
    },
    onDisconnected: () => {
      if (echoTailTimerRef.current) {
        clearTimeout(echoTailTimerRef.current);
        echoTailTimerRef.current = null;
      }
      setMicSuppressedRef.current(false);
      stopMicFnRef.current();
      destroyPlayback();
      stopMeteringFnRef.current();
      releaseAudioContext();
      resetVideoPlayerRef.current();
      isAgentSpeakingRef.current = false;
      lastAgentTurnIndexRef.current = null;
    },
  }), [ensureAudioContext, initPlayback, queueAudio, stopPlayback, destroyPlayback, releaseAudioContext]);

  const {
    connectionState,
    currentPhase,
    logEntries,
    connect,
    disconnect,
    sendAudioChunk,
    injectUserMessage,
    updatePrompt,
    sendFunctionCallResponse,
    clearLog,
  } = useDeepgramAgent(agentCallbacks);

  const { micAnalyserRef, isMicMuted, isMicMutedRef, startMic, stopMic, toggleMicMute, setMicSuppressed } =
    useMicrophone(sendAudioChunk);

  const { userLevel, agentLevel, startMetering, stopMetering } = useVuMeter();

  const {
    videoPlayerState,
    setVideoElement,
    handleVideoFunctionCall,
    pauseVideoOnBargeIn,
    handleVideoLoadStateChange,
    handleVideoEnded,
    resetVideoPlayer,
  } = useVideoPlayer();

  const startMicFnRef = useRef((_audioContext: AudioContext) => {
    return Promise.resolve();
  });
  const stopMicFnRef = useRef(stopMic);
  const startMeteringFnRef = useRef(() => {
    startMetering(micAnalyserRef, playbackAnalyserRef, () => isMicMutedRef.current);
  });
  const stopMeteringFnRef = useRef(stopMetering);

  useEffect(() => {
    startMicFnRef.current = (audioContext: AudioContext) => {
      return startMic(audioContext).catch((micStartError) => {
        console.warn(
          JSON.stringify({
            level: "warn",
            component: "flux_agent_bench",
            event: "mic_start_failed",
            payload: { error: String(micStartError) },
          })
        );
      });
    };
    stopMicFnRef.current = stopMic;
    setMicSuppressedRef.current = setMicSuppressed;
    sendFunctionCallResponseRef.current = sendFunctionCallResponse;
    handleVideoFunctionCallRef.current = handleVideoFunctionCall;
    resetVideoPlayerRef.current = resetVideoPlayer;
    pauseVideoOnBargeInRef.current = pauseVideoOnBargeIn;
    startMeteringFnRef.current = () => {
      startMetering(micAnalyserRef, playbackAnalyserRef, () => isMicMutedRef.current);
    };
    stopMeteringFnRef.current = stopMetering;
  });

  const buildCombinedPrompt = useCallback(() => {
    let productSection = "";
    let videoPromptSection = "";
    try {
      const parsed = JSON.parse(productConfigJson) as ProductConfig;
      productSection = buildProductPrompt(parsed);
      if (parsed.video && parsed.video.videoChapters.length > 0) {
        videoPromptSection = buildVideoPromptSection(parsed.video);
      }
    } catch {
      productSection = productConfigJson.trim();
    }
    return [behaviorPrompt.trim(), productSection, videoPromptSection]
      .filter(Boolean)
      .join("\n\n");
  }, [behaviorPrompt, productConfigJson]);

  const handleConnect = useCallback(() => {
    setTranscriptTurns([]);
    const videoFunctions = activeProductVideoConfig
      ? buildVideoFunctionDefinitions()
      : undefined;
    connect(apiKeyValue, {
      voiceModel,
      thinkModel,
      speed: parseFloat(speed),
      eotThreshold: parseFloat(eotThreshold),
      systemPrompt: buildCombinedPrompt(),
      greeting: greeting.trim(),
      functions: videoFunctions,
    });
  }, [apiKeyValue, voiceModel, thinkModel, speed, eotThreshold, buildCombinedPrompt, greeting, connect, activeProductVideoConfig]);

  const handleApplyPromptLive = useCallback(() => {
    updatePrompt(buildCombinedPrompt());
  }, [buildCombinedPrompt, updatePrompt]);

  const isConnected = connectionState === "live";

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="mx-auto max-w-[1180px] px-5 pt-5 pb-15">
      <header className="mb-1.5 flex flex-wrap items-baseline gap-3.5">
        <h1 className="font-display text-xl font-bold tracking-tight">Flux agent bench</h1>
        <span className="font-mono text-[11.5px] tracking-wide text-ink3">
          deepgram voice agent - flux stt + flux tts
        </span>
      </header>
      <p className="mt-0.5 max-w-[640px] text-xs leading-relaxed text-ink2">
        Local testing only. The key you paste stays in this tab and is sent straight to Deepgram
        over the WebSocket —{" "}
        <strong className="font-medium text-warn">
          don&apos;t deploy this file anywhere public.
        </strong>{" "}
        Ship a token endpoint before it leaves your machine.
      </p>

      <div className="mt-4 grid items-start gap-4 max-lg:grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="space-y-3.5">
          <ConnectionPanel
            connectionState={connectionState}
            voiceModel={voiceModel}
            onVoiceModelChange={setVoiceModel}
            thinkModel={thinkModel}
            onThinkModelChange={setThinkModel}
            speed={speed}
            onSpeedChange={setSpeed}
            eotThreshold={eotThreshold}
            onEotThresholdChange={setEotThreshold}
            onConnect={handleConnect}
            onDisconnect={disconnect}
            isMicMuted={isMicMuted}
            onToggleMute={toggleMicMute}
          />

          <SystemPromptPanel
            behaviorPrompt={behaviorPrompt}
            onBehaviorPromptChange={setBehaviorPrompt}
            productConfigJson={productConfigJson}
            onProductConfigJsonChange={setProductConfigJson}
            greeting={greeting}
            onGreetingChange={setGreetingOverride}
            onApplyLive={handleApplyPromptLive}
            isConnected={isConnected}
            availableProducts={availableProducts}
            selectedProductFile={selectedProductFile}
            onProductFileChange={handleProductFileChange}
          />

          <TextInjectPanel onSend={injectUserMessage} isConnected={isConnected} />
        </div>

        <div className="space-y-3.5">
          {activeProductVideoConfig && (
            <VideoPlayerPanel
              videoUrl={activeProductVideoConfig.videoUrl}
              onVideoElementReady={setVideoElement}
              isVideoPlaying={videoPlayerState.isVideoPlaying}
              videoPlaybackSpeed={videoPlayerState.videoPlaybackSpeed}
              videoOverlayText={videoPlayerState.videoOverlayText}
              isVideoLoading={videoPlayerState.isVideoLoading}
              isVideoEnded={videoPlayerState.isVideoEnded}
              onVideoLoadStateChange={handleVideoLoadStateChange}
              onVideoEnded={handleVideoEnded}
            />
          )}

          <LivePanel
            currentPhase={currentPhase}
            userLevel={userLevel}
            agentLevel={agentLevel}
            turns={transcriptTurns}
          />

          <EventLog entries={logEntries} onClear={clearLog} />
        </div>
      </div>
    </div>
  );
}
