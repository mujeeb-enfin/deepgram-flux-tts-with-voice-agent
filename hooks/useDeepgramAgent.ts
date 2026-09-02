"use client";

import { useRef, useCallback, useState } from "react";

const DEEPGRAM_AGENT_URL = "wss://agent.deepgram.com/v1/agent/converse";
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const KEEPALIVE_INTERVAL_MS = 8000;

export type ConnectionState = "idle" | "connecting" | "live" | "error";

export interface AgentSettings {
  voiceModel: string;
  thinkModel: string;
  speed: number;
  eotThreshold: number;
  systemPrompt: string;
  greeting: string;
}

export interface LogEntry {
  timestamp: number;
  message: string;
  level: "" | "hi" | "bad";
}

export interface TranscriptTurn {
  role: "user" | "agent";
  text: string;
  wasCutOff: boolean;
}

export interface DeepgramAgentCallbacks {
  onAudioData: (buffer: ArrayBuffer) => void;
  onSettingsApplied: () => void | Promise<void>;
  onUserStartedSpeaking: () => void;
  onAgentStartedSpeaking: () => void;
  onAgentAudioDone: () => void;
  onConversationText: (role: "user" | "agent", content: string) => void;
  onDisconnected: () => void;
}

export function useDeepgramAgent(callbacks: DeepgramAgentCallbacks) {
  const websocketRef = useRef<WebSocket | null>(null);
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionStartTimeRef = useRef(0);
  const receivedWelcomeRef = useRef(false);

  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [currentPhase, setCurrentPhase] = useState("not connected");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLogEntry = useCallback((message: string, level: "" | "hi" | "bad" = "") => {
    const elapsed = connectionStartTimeRef.current
      ? Date.now() - connectionStartTimeRef.current
      : 0;
    setLogEntries((prev) => [...prev, { timestamp: elapsed, message, level }]);
  }, []);

  const clearLog = useCallback(() => {
    setLogEntries([]);
  }, []);

  const sendAudioChunk = useCallback((buffer: ArrayBuffer) => {
    const ws = websocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(buffer);
    }
  }, []);

  const cleanupConnection = useCallback(() => {
    if (keepAliveTimerRef.current) {
      clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    websocketRef.current = null;
    setConnectionState("idle");
    setCurrentPhase("not connected");
  }, []);

  const connect = useCallback(
    (apiKey: string, settings: AgentSettings) => {
      const trimmedKey = apiKey.replace(/\s+/g, "");
      if (!trimmedKey) {
        setConnectionState("error");
        addLogEntry("paste an API key first", "bad");
        return;
      }
      if (apiKey !== trimmedKey) {
        addLogEntry("stripped whitespace from the key", "bad");
      }
      if (!/^[A-Za-z0-9._-]+$/.test(trimmedKey)) {
        addLogEntry("key contains illegal characters for WebSocket subprotocol", "bad");
        setConnectionState("error");
        return;
      }

      receivedWelcomeRef.current = false;
      connectionStartTimeRef.current = Date.now();
      setConnectionState("connecting");
      setCurrentPhase("connecting");
      addLogEntry("open " + DEEPGRAM_AGENT_URL);

      let ws: WebSocket;
      try {
        ws = new WebSocket(DEEPGRAM_AGENT_URL, ["token", trimmedKey]);
      } catch (err) {
        addLogEntry("socket refused: " + (err as Error).message, "bad");
        setConnectionState("error");
        return;
      }
      ws.binaryType = "arraybuffer";
      websocketRef.current = ws;

      ws.onopen = () => {
        addLogEntry("socket open", "hi");
        const settingsPayload = {
          type: "Settings",
          audio: {
            input: { encoding: "linear16", sample_rate: INPUT_SAMPLE_RATE },
            output: { encoding: "linear16", sample_rate: OUTPUT_SAMPLE_RATE, container: "none" },
          },
          agent: {
            listen: {
              provider: {
                type: "deepgram",
                model: "flux-general-en",
                version: "v2",
                eot_threshold: settings.eotThreshold,
              },
            },
            think: {
              provider: { type: "open_ai", model: settings.thinkModel },
              prompt: settings.systemPrompt,
            },
            speak: {
              provider: {
                type: "deepgram",
                version: "v2",
                model: settings.voiceModel,
                speed: settings.speed,
              },
            },
            greeting: settings.greeting || undefined,
          },
        };
        ws.send(JSON.stringify(settingsPayload));
        addLogEntry(
          `-> Settings - ${settings.voiceModel} - prompt ${settings.systemPrompt.length} chars`
        );
        keepAliveTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, KEEPALIVE_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") {
          callbacks.onAudioData(event.data);
          return;
        }
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(event.data);
        } catch (websocketParseError) {
          console.warn(
            JSON.stringify({
              level: "warn",
              component: "use_deepgram_agent",
              event: "websocket_message_parse_failed",
              payload: {
                error: String(websocketParseError),
                preview: String(event.data).slice(0, 100),
              },
            })
          );
          return;
        }

        switch (parsed.type) {
          case "Welcome":
            receivedWelcomeRef.current = true;
            addLogEntry(
              `<- Welcome - ${(parsed.request_id as string) || (parsed.session_id as string) || ""}`,
              "hi"
            );
            break;
          case "SettingsApplied":
            addLogEntry("<- SettingsApplied", "hi");
            setConnectionState("live");
            setCurrentPhase("listening");
            callbacks.onSettingsApplied();
            break;
          case "UserStartedSpeaking":
            setCurrentPhase("you're speaking");
            callbacks.onUserStartedSpeaking();
            addLogEntry("<- UserStartedSpeaking");
            break;
          case "AgentThinking":
            setCurrentPhase("thinking");
            addLogEntry("<- AgentThinking");
            break;
          case "AgentStartedSpeaking": {
            setCurrentPhase("agent speaking");
            const latencyMs = parsed.total_latency
              ? ` - ${Math.round((parsed.total_latency as number) * 1000)}ms`
              : "";
            addLogEntry(`<- AgentStartedSpeaking${latencyMs}`, "hi");
            callbacks.onAgentStartedSpeaking();
            break;
          }
          case "AgentAudioDone":
            setCurrentPhase("listening");
            addLogEntry("<- AgentAudioDone");
            callbacks.onAgentAudioDone();
            break;
          case "ConversationText":
            addLogEntry(`<- ConversationText [${parsed.role}]`);
            callbacks.onConversationText(
              parsed.role === "assistant" ? "agent" : "user",
              parsed.content as string
            );
            break;
          case "PromptUpdated":
            addLogEntry("<- PromptUpdated", "hi");
            break;
          case "Error":
            addLogEntry(
              `<- Error - ${(parsed.description as string) || (parsed.message as string) || JSON.stringify(parsed)}`,
              "bad"
            );
            setConnectionState("error");
            break;
          case "Warning":
            addLogEntry(`<- Warning - ${(parsed.description as string) || ""}`, "bad");
            break;
          default:
            addLogEntry(`<- ${parsed.type}`);
        }
      };

      ws.onerror = () => {
        addLogEntry("socket error (browsers hide handshake details)", "bad");
        setConnectionState("error");
      };

      ws.onclose = (event) => {
        const closeReasons: Record<number, string> = {
          1000: "clean close",
          1005: "closed with no status",
          1006: "handshake rejected — check 401 (bad key) or 403 (no voice agent access)",
          1008: "policy violation — key rejected or project not entitled",
          1009: "message too large",
          1011: "server error",
        };
        const reason = closeReasons[event.code] || "unexpected";
        addLogEntry(
          `socket closed (${event.code}) - ${reason}${event.reason ? ` - ${event.reason}` : ""}`,
          "bad"
        );
        if (event.code === 1006 && !receivedWelcomeRef.current) {
          addLogEntry("handshake failed before Welcome — verify the API key and Voice Agent entitlement", "bad");
        }
        cleanupConnection();
        callbacks.onDisconnected();
      };
    },
    [addLogEntry, callbacks, cleanupConnection]
  );

  const disconnect = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    cleanupConnection();
    callbacks.onDisconnected();
  }, [cleanupConnection, callbacks]);

  const injectUserMessage = useCallback(
    (content: string) => {
      const ws = websocketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "InjectUserMessage", content }));
      addLogEntry("-> InjectUserMessage");
    },
    [addLogEntry]
  );

  const updatePrompt = useCallback(
    (prompt: string) => {
      const ws = websocketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "UpdatePrompt", prompt }));
      addLogEntry(`-> UpdatePrompt - ${prompt.length} chars`);
    },
    [addLogEntry]
  );

  return {
    connectionState,
    currentPhase,
    logEntries,
    connect,
    disconnect,
    sendAudioChunk,
    injectUserMessage,
    updatePrompt,
    clearLog,
  };
}
