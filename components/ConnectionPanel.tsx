"use client";

import type { ConnectionState } from "@/hooks/useDeepgramAgent";
import { StatusDot } from "./StatusDot";

interface ConnectionPanelProps {
  connectionState: ConnectionState;
  voiceModel: string;
  onVoiceModelChange: (value: string) => void;
  thinkModel: string;
  onThinkModelChange: (value: string) => void;
  speed: string;
  onSpeedChange: (value: string) => void;
  eotThreshold: string;
  onEotThresholdChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  isMicMuted: boolean;
  onToggleMute: () => void;
}

const fluxVoiceOptions = [
  { value: "flux-kit-en", label: "Kit", agentName: "Kit", "regions": ["US"] },
  { value: "flux-haley-en", label: "Haley", agentName: "Haley", "regions": ["CA"] },
  { value: "flux-heather-en", label: "Heather", agentName: "Heather", "regions": ["SG", "JP", "KR", "CN", "HK", "TW", "PH"] },
  { value: "flux-priya-en", label: "Priya", agentName: "Priya", "regions": ["IN", "PK", "NP", "LK", "BD"] },
  { value: "flux-jack-en", label: "Jack", agentName: "Jack", "regions": ["GB", "IE"] },
  { value: "flux-bruce-en", label: "Bruce", agentName: "Bruce", "regions": ["AU", "NZ"] },
  { value: "flux-rufus-en", label: "Rufus", agentName: "Rufus", "regions": ["US"] },
  { value: "flux-drew-en", label: "Drew", agentName: "Drew", "regions": ["US"] },
  { value: "flux-alexis-en", label: "Alexis", agentName: "Alexis", "regions": ["US"] },
];

export function getAgentNameForVoice(voiceModel: string): string {
  const match = fluxVoiceOptions.find((opt) => opt.value === voiceModel);
  return match?.agentName ?? "Agent";
}

export function getFluxVoiceForBrowserRegion(): string | null {
  if (typeof navigator === "undefined") return null;
  const browserLanguage = navigator.language ?? navigator.languages?.[0];
  if (!browserLanguage) return null;
  const regionMatch = browserLanguage.match(/[-_]([A-Z]{2})$/i);
  if (!regionMatch) return null;
  const regionCode = regionMatch[1].toUpperCase();
  const matched = fluxVoiceOptions.find((opt) => opt.regions.includes(regionCode));
  return matched?.value ?? null;
}

const thinkModelOptions = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  { value: "gpt-4o", label: "gpt-4o" },
  { value: "gpt-5-mini", label: "gpt-5-mini" },
];

const speedOptions = ["0.9", "0.95", "1.0", "1.05", "1.1"];
const eotOptions = ["0.5", "0.6", "0.7", "0.8", "0.9"];

const inputClasses =
  "w-full rounded-md border border-line bg-input-bg px-2.5 py-2 font-sans text-[13.5px] text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal-ring";
const selectClasses = inputClasses;
const labelClasses =
  "mb-1 block font-mono text-[10.5px] uppercase tracking-widest text-ink2";
const buttonBase =
  "rounded-md border px-3.5 py-2 font-sans text-[13.5px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function ConnectIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm6.39-2.908a.75.75 0 0 1 .766.027l3.5 2.25a.75.75 0 0 1 0 1.262l-3.5 2.25A.75.75 0 0 1 8 12.25v-4.5a.75.75 0 0 1 .39-.658Z" clipRule="evenodd" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm5-2.25A.75.75 0 0 1 7.75 7h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Zm4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-4.5Z" clipRule="evenodd" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
      <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
      <path d="M17.78 2.22a.75.75 0 0 0-1.06 0l-3.22 3.22V4a3 3 0 0 0-6 0v6c0 .094.005.187.014.278l-1.748 1.748A4.477 4.477 0 0 1 5.5 10v-.357a.75.75 0 0 0-1.5 0V10c0 1.9.882 3.594 2.258 4.697l-1.48 1.48a6.467 6.467 0 0 1-1.028-.837.75.75 0 0 0-1.06 1.06c.424.424.901.8 1.42 1.12l-1.33 1.33a.75.75 0 1 0 1.06 1.06L17.78 3.28a.75.75 0 0 0 0-1.06Z" />
      <path d="M10.75 15.954A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.48 4.48 0 0 1-1.307 3.173l-1.27 1.27v1.057h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5v-1.046h.327ZM13 10V6.122l-4.576 4.576A3 3 0 0 0 13 10Z" />
    </svg>
  );
}

export function ConnectionPanel({
  connectionState,
  voiceModel,
  onVoiceModelChange,
  thinkModel,
  onThinkModelChange,
  speed,
  onSpeedChange,
  eotThreshold,
  onEotThresholdChange,
  onConnect,
  onDisconnect,
  isMicMuted,
  onToggleMute,
}: ConnectionPanelProps) {
  const isConnected = connectionState === "live";
  const isConnecting = connectionState === "connecting";

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          Connection
        </h2>
        <StatusDot connectionState={connectionState} />
      </div>
      <div className="space-y-3 p-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="bench_connection_voice" className={labelClasses}>
              Flux voice
            </label>
            <select
              id="bench_connection_voice"
              value={voiceModel}
              onChange={(e) => onVoiceModelChange(e.target.value)}
              className={selectClasses}
            >
              {fluxVoiceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bench_connection_llm" className={labelClasses}>
              Think model
            </label>
            <select
              id="bench_connection_llm"
              value={thinkModel}
              onChange={(e) => onThinkModelChange(e.target.value)}
              className={selectClasses}
            >
              {thinkModelOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="bench_connection_speed" className={labelClasses}>
              Speed
            </label>
            <select
              id="bench_connection_speed"
              value={speed}
              onChange={(e) => onSpeedChange(e.target.value)}
              className={selectClasses}
            >
              {speedOptions.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bench_connection_eot" className={labelClasses}>
              EOT threshold
            </label>
            <select
              id="bench_connection_eot"
              value={eotThreshold}
              onChange={(e) => onEotThresholdChange(e.target.value)}
              className={selectClasses}
            >
              {eotOptions.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="bench_connection_connectBtn"
            onClick={onConnect}
            disabled={isConnected || isConnecting}
            title="Connect and talk"
            className={`${buttonBase} border-signal bg-signal text-white hover:border-signal-hover hover:bg-signal-hover px-2.5`}
          >
            <ConnectIcon />
          </button>
          <button
            id="bench_connection_disconnectBtn"
            onClick={onDisconnect}
            disabled={!isConnected}
            title="Disconnect"
            className={`${buttonBase} border-danger bg-danger text-white px-2.5`}
          >
            <DisconnectIcon />
          </button>
          <button
            id="bench_connection_muteBtn"
            onClick={onToggleMute}
            disabled={!isConnected}
            title={isMicMuted ? "Unmute mic" : "Mute mic"}
            className={`${buttonBase} border-line bg-panel text-ink hover:border-ink3 px-2.5`}
          >
            {isMicMuted ? <MicOffIcon /> : <MicOnIcon />}
          </button>
        </div>
      </div>
    </section>
  );
}
