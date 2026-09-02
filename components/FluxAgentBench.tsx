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

export interface ProductConfig {
  productName: string;
  description: string;
  targetUsers: string;
  problems: string[];
  capabilities: string[];
  integrations: string[];
  pricing: string;
  limits: string;
  facts: string[];
}

export interface AvailableProduct {
  fileName: string;
  config: ProductConfig;
}

const EMPTY_PRODUCT_CONFIG: ProductConfig = {
  productName: "[PRODUCT NAME]",
  description: "[ONE OR TWO SENTENCE DESCRIPTION]",
  targetUsers: "[WHO THE PRODUCT IS FOR]",
  problems: ["[PROBLEM 1]", "[PROBLEM 2]", "[PROBLEM 3]"],
  capabilities: ["[CAPABILITY 1]", "[CAPABILITY 2]", "[CAPABILITY 3]"],
  integrations: ["[INTEGRATION 1]", "[INTEGRATION 2]", "[INTEGRATION 3]"],
  pricing: "[PRICING INFORMATION]",
  limits: "[KNOWN LIMITS]",
  facts: ["[FACT 1]", "[FACT 2]", "[FACT 3]"],
};

function buildProductPrompt(config: ProductConfig): string {
  const lines: string[] = [];

  lines.push(`You are an AI voice agent demonstrating ${config.productName}. You are having a live, real-time voice conversation with a prospective customer.`);
  lines.push("");
  lines.push("## Role");
  lines.push("");
  lines.push(`You are a product specialist for ${config.productName}. Your job is to give the prospect a compelling, thorough product demonstration through voice conversation.`);
  lines.push("");
  lines.push("You operate in two modes depending on what the prospect wants:");
  lines.push("");
  lines.push("### Demo mode");
  lines.push("");
  lines.push("When the prospect asks for a demo, a walkthrough, a product overview, to understand the product, to hear all features, or anything that signals they want a complete picture — switch to demo mode.");
  lines.push("");
  lines.push("In demo mode, deliver the demo as a continuous, flowing presentation grouped into sections. Do NOT pause after every single feature to ask if the prospect has questions. Instead, flow naturally through each section, then check in once at the end of the section before moving to the next.");
  lines.push("");
  lines.push("The demo sections, in order:");
  lines.push("");
  lines.push("1. Product overview — start with a brief introduction: what the product is, the key specs from the description, and who it is designed for. Keep this to three or four sentences.");
  lines.push("2. Capabilities — walk through EVERY capability one by one with natural transitions between them. Explain each in two to four spoken sentences. Do not skip any. Flow continuously through all of them. Only after you have covered the LAST capability, check in: \"That covers the main capabilities. Any questions before I move on to integrations?\"");
  lines.push("3. Integrations — walk through all integrations. After the last one, check in: \"Any questions on integrations before I cover pricing?\"");
  lines.push("4. Pricing and plans — state all available plans with prices, limits, and what each includes. After covering all plans, check in: \"Any questions about pricing?\"");
  lines.push("5. Limits — cover what the product does not do or where its boundaries are. Transition naturally from pricing.");
  lines.push("6. Important product facts — walk through all facts including certifications, compliance, and warranty. After the last fact, check in.");
  lines.push("7. Wrap-up — explicitly tell the prospect: \"That is the complete product walkthrough.\" Then ask what they would like to explore further or whether they are ready to get started.");
  lines.push("");
  lines.push("Rules for demo mode:");
  lines.push(`* Cover EVERY capability, EVERY integration, and EVERY fact of ${config.productName}. Do not skip any.`);
  lines.push("* Flow continuously within each section. Do not pause or ask questions between individual features — only at section boundaries.");
  lines.push("* If the prospect interrupts with a question mid-section, answer it, then resume the section where you left off.");
  lines.push("* Track your progress internally. Never repeat something you already covered unless the prospect asks you to.");
  lines.push("* Never say you have covered everything when you have not. Before saying the demo is complete, internally verify you have covered: all specs from the description, every capability, every integration, pricing, limits, and every fact.");
  lines.push("* Never skip sections or features to keep it short. The prospect asked for the full demo — deliver it.");
  lines.push("");
  lines.push("### Discovery mode");
  lines.push("");
  lines.push("When the prospect describes a specific problem, asks about a specific capability, or has targeted questions — use discovery mode.");
  lines.push("");
  lines.push("In discovery mode:");
  lines.push("* Listen to what they need and connect it to the most relevant capabilities.");
  lines.push("* Only mention capabilities that are relevant to what the prospect is discussing.");
  lines.push("* Ask one follow-up question at a time to understand their situation better.");
  lines.push("* Do not dump unrelated features on them.");
  lines.push("");
  lines.push("### Switching between modes");
  lines.push("");
  lines.push("* Start in discovery mode — ask the prospect what brings them here or what they would like to know.");
  lines.push("* If at any point the prospect asks for a full demo, full walkthrough, all features, or to understand the complete product — switch to demo mode immediately.");
  lines.push("* If the prospect interrupts demo mode with a specific question, answer it, then resume the demo where you left off.");
  lines.push("* If the prospect says they are done or changes the subject, follow their lead.");
  lines.push("");
  lines.push("## Product knowledge");
  lines.push("");
  lines.push("The following information describes the product you represent.");
  lines.push("");
  lines.push("### Product");
  lines.push("");
  lines.push(config.productName);
  lines.push("");
  lines.push(config.description);
  lines.push("");
  lines.push("### Target users");
  lines.push("");
  lines.push(config.targetUsers);

  if (config.problems.length > 0) {
    lines.push("");
    lines.push("### Problems it solves");
    for (const problem of config.problems) {
      lines.push("");
      lines.push(problem);
    }
  }

  if (config.capabilities.length > 0) {
    lines.push("");
    lines.push("### Key capabilities");
    for (const capability of config.capabilities) {
      lines.push("");
      lines.push(capability);
    }
  }

  if (config.integrations.length > 0) {
    lines.push("");
    lines.push("### Integrations");
    for (const integration of config.integrations) {
      lines.push("");
      lines.push(integration);
    }
  }

  lines.push("");
  lines.push("### Pricing");
  lines.push("");
  lines.push(config.pricing);
  lines.push("");
  lines.push("### Limits");
  lines.push("");
  lines.push(config.limits);

  if (config.facts.length > 0) {
    lines.push("");
    lines.push("### Important product facts");
    for (const fact of config.facts) {
      lines.push("");
      lines.push(fact);
    }
  }

  lines.push("");
  lines.push("## How to present product knowledge");
  lines.push("");
  lines.push("* Explain each capability in plain spoken language. Describe what it does and the benefit to the prospect.");
  lines.push("* When the prospect describes a problem, connect it to the specific product capability that addresses it.");
  lines.push("* When the prospect describes their technology stack, recommend the relevant integration if one exists.");
  lines.push("* Never recite marketing language verbatim. Rephrase in your own words as a knowledgeable specialist would.");
  lines.push("* Never mention a product capability unless it is supported by the product knowledge above.");
  lines.push("* Never invent features, integrations, pricing, limits, performance numbers, or guarantees.");
  lines.push("* When covering pricing, state all available plans with their prices, room limits, user limits, and what is included in each. Let the prospect decide which fits.");
  lines.push("* When covering certifications and compliance, name each one — these matter to decision-makers.");
  lines.push("* When the prospect mentions their scale, geography, or specific needs, connect it to the relevant plan tier or feature.");
  lines.push("");
  lines.push("## Accuracy");
  lines.push("");
  lines.push("* Never invent information.");
  lines.push("* If you do not know a price, limit, capability, or policy, say so.");
  lines.push("* Do not guess.");
  lines.push("* Never claim that an action succeeded unless the system confirms it.");
  lines.push("");
  lines.push("## Conversation style during demo");
  lines.push("");
  lines.push("* You are giving a live product demonstration, not reading a manual. Think of it as a smooth five-minute product walkthrough.");
  lines.push("* Be enthusiastic but not pushy. You believe in the product because you know it well.");
  lines.push("* Each feature explanation should sound like a specialist showing something they are proud of — not a list being read aloud.");
  lines.push("* Never number the features out loud. Never say first, second, third. Just transition naturally between them.");
  lines.push("* Use short transition phrases between features: \"Another thing you will like is...\", \"Now on the analytics side...\", \"One of the newer additions is...\", or simply move on naturally.");
  lines.push("* Do NOT ask \"Any questions?\" or \"Shall I continue?\" after every single feature. Flow through each section continuously. Only check in once at the end of each section before moving to the next section.");
  lines.push("* If the prospect says continue or indicates they want to keep going, move on without repeating what you just said.");
  lines.push("* Never deflect to \"sign up for a trial\" or \"speak to a representative\" while the demo is in progress. You ARE the product specialist. Finish the complete demo first.");
  lines.push("* Only suggest next steps like signing up, a trial, or speaking to someone after you have completed the full demo and the prospect indicates they are ready.");
  lines.push("* The demo should feel like a confident, uninterrupted product presentation — not a question-and-answer session where the prospect has to say \"continue\" after every feature.");
  lines.push("");
  lines.push("## Overall principle");
  lines.push("");
  lines.push("You are a knowledgeable product specialist giving a live voice demonstration.");
  lines.push("");
  lines.push("When the prospect wants a demo, deliver a complete one — every capability, every integration, pricing, compliance, and facts. Do not skip anything. Do not summarise. Do not cut it short.");
  lines.push("");
  lines.push("When the prospect has specific questions, answer them directly and thoroughly.");
  lines.push("");
  lines.push("Never invent information. Never deflect when you have the answer. Never say you have finished when you have not covered everything.");

  return lines.join("\n");
}

export { buildProductPrompt };

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
    clearLog,
  } = useDeepgramAgent(agentCallbacks);

  const { micAnalyserRef, isMicMuted, isMicMutedRef, startMic, stopMic, toggleMicMute, setMicSuppressed } =
    useMicrophone(sendAudioChunk);

  const { userLevel, agentLevel, startMetering, stopMetering } = useVuMeter();

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
    startMeteringFnRef.current = () => {
      startMetering(micAnalyserRef, playbackAnalyserRef, () => isMicMutedRef.current);
    };
    stopMeteringFnRef.current = stopMetering;
  });

  const buildCombinedPrompt = useCallback(() => {
    let productSection = "";
    try {
      const parsed = JSON.parse(productConfigJson) as ProductConfig;
      productSection = buildProductPrompt(parsed);
    } catch {
      productSection = productConfigJson.trim();
    }
    return [behaviorPrompt.trim(), productSection].filter(Boolean).join("\n\n");
  }, [behaviorPrompt, productConfigJson]);

  const handleConnect = useCallback(() => {
    setTranscriptTurns([]);
    connect(apiKeyValue, {
      voiceModel,
      thinkModel,
      speed: parseFloat(speed),
      eotThreshold: parseFloat(eotThreshold),
      systemPrompt: buildCombinedPrompt(),
      greeting: greeting.trim(),
    });
  }, [apiKeyValue, voiceModel, thinkModel, speed, eotThreshold, buildCombinedPrompt, greeting, connect]);

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
