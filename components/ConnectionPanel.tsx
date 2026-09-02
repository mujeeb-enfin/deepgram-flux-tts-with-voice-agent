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
  // American English
  { value: "flux-haley-en", label: "Haley (American)", agentName: "Haley", regions: ["US", "CA"] },
  { value: "flux-heather-en", label: "Heather (American)", agentName: "Heather", regions: ["US", "CA"] },
  { value: "flux-bruce-en", label: "Bruce (American)", agentName: "Bruce", regions: ["US", "CA"] },
  { value: "flux-drew-en", label: "Drew (American)", agentName: "Drew", regions: ["US", "CA"] },
  { value: "flux-alexis-en", label: "Alexis (American)", agentName: "Alexis", regions: ["US", "CA"] },
  { value: "flux-hannah-en", label: "Hannah (American)", agentName: "Hannah", regions: ["US", "CA"] },
  { value: "flux-cliff-en", label: "Cliff (American)", agentName: "Cliff", regions: ["US", "CA"] },
  { value: "flux-sienna-en", label: "Sienna (American)", agentName: "Sienna", regions: ["US", "CA"] },
  { value: "flux-cole-en", label: "Cole (American)", agentName: "Cole", regions: ["US", "CA"] },
  { value: "flux-brooke-en", label: "Brooke (American)", agentName: "Brooke", regions: ["US", "CA"] },
  { value: "flux-miles-en", label: "Miles (American)", agentName: "Miles", regions: ["US", "CA"] },
  { value: "flux-bree-en", label: "Bree (American)", agentName: "Bree", regions: ["US", "CA"] },
  { value: "flux-brittany-en", label: "Brittany (American)", agentName: "Brittany", regions: ["US", "CA"] },
  { value: "flux-donovan-en", label: "Donovan (American)", agentName: "Donovan", regions: ["US", "CA"] },
  { value: "flux-elise-en", label: "Elise (American)", agentName: "Elise", regions: ["US", "CA"] },
  { value: "flux-kelsey-en", label: "Kelsey (American)", agentName: "Kelsey", regions: ["US", "CA"] },
  { value: "flux-marcus-en", label: "Marcus (American)", agentName: "Marcus", regions: ["US", "CA"] },
  { value: "flux-meghan-en", label: "Meghan (American)", agentName: "Meghan", regions: ["US", "CA"] },
  { value: "flux-paige-en", label: "Paige (American)", agentName: "Paige", regions: ["US", "CA"] },
  { value: "flux-wade-en", label: "Wade (American)", agentName: "Wade", regions: ["US", "CA"] },
  { value: "flux-wes-en", label: "Wes (American)", agentName: "Wes", regions: ["US", "CA"] },
  // British English
  { value: "flux-kit-en", label: "Kit (British)", agentName: "Kit", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-jack-en", label: "Jack (British)", agentName: "Jack", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-rufus-en", label: "Rufus (British)", agentName: "Rufus", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-colin-en", label: "Colin (British)", agentName: "Colin", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-gemma-en", label: "Gemma (British)", agentName: "Gemma", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-sean-en", label: "Sean (British)", agentName: "Sean", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-conor-en", label: "Conor (British)", agentName: "Conor", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  { value: "flux-tanner-en", label: "Tanner (British)", agentName: "Tanner", regions: ["GB", "IE", "ZA", "KE", "NG"] },
  // Indian English
  { value: "flux-priya-en", label: "Priya (Indian)", agentName: "Priya", regions: ["IN", "PK", "NP", "LK", "BD"] },
  { value: "flux-meena-en", label: "Meena (Indian)", agentName: "Meena", regions: ["IN", "PK", "NP", "LK", "BD"] },
  { value: "flux-naveen-en", label: "Naveen (Indian)", agentName: "Naveen", regions: ["IN", "PK", "NP", "LK", "BD"] },
  // Irish English
  { value: "flux-maeve-en", label: "Maeve (Irish)", agentName: "Maeve", regions: ["IE"] },
  // Australian English
  { value: "flux-sharon-en", label: "Sharon (Australian)", agentName: "Sharon", regions: ["AU", "NZ"] },
  // Singaporean English
  { value: "flux-kai-en", label: "Kai (Singaporean)", agentName: "Kai", regions: ["SG", "MY"] },
  // Filipino English
  { value: "flux-marcelo-en", label: "Marcelo (Filipino)", agentName: "Marcelo", regions: ["PH"] },
];

export function getAgentNameForVoice(voiceModel: string): string {
  const match = fluxVoiceOptions.find((opt) => opt.value === voiceModel);
  return match?.agentName ?? "Agent";
}

const timezoneToRegionCode: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Colombo": "LK",
  "Asia/Karachi": "PK",
  "Asia/Kathmandu": "NP",
  "Asia/Katmandu": "NP",
  "Asia/Dhaka": "BD",
  "Asia/Dacca": "BD",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Lisbon": "PT",
  "Europe/Warsaw": "PL",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Pacific/Auckland": "NZ",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Manila": "PH",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Africa/Johannesburg": "ZA",
  "Africa/Nairobi": "KE",
  "Africa/Lagos": "NG",
};

function detectRegionCode(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone && timezoneToRegionCode[timezone]) {
      return timezoneToRegionCode[timezone];
    }
  } catch {
    // Intl not available
  }
  if (typeof navigator === "undefined") return null;
  const browserLanguage = navigator.language ?? navigator.languages?.[0];
  if (!browserLanguage) return null;
  const regionMatch = browserLanguage.match(/[-_]([A-Z]{2})$/i);
  if (!regionMatch) return null;
  return regionMatch[1].toUpperCase();
}

export function getFluxVoiceForBrowserRegion(): string | null {
  if (typeof window === "undefined") return null;
  const regionCode = detectRegionCode();
  if (!regionCode) return null;
  const matchedVoices = fluxVoiceOptions.filter((opt) => opt.regions.includes(regionCode));
  if (matchedVoices.length === 0) {
    const americanVoices = fluxVoiceOptions.filter((opt) => opt.regions.includes("US"));
    if (americanVoices.length === 0) return null;
    const fallbackIndex = Math.floor(Math.random() * americanVoices.length);
    return americanVoices[fallbackIndex].value;
  }
  const randomIndex = Math.floor(Math.random() * matchedVoices.length);
  return matchedVoices[randomIndex].value;
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
