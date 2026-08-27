"use client";

import { useState, useCallback } from "react";

const inputClasses =
  "w-full rounded-md border border-line bg-input-bg px-2.5 py-2 font-sans text-[13.5px] text-ink outline-none focus:border-signal focus:ring-3 focus:ring-signal-ring";

interface TextInjectPanelProps {
  onSend: (message: string) => void;
  isConnected: boolean;
}

export function TextInjectPanel({ onSend, isConnected }: TextInjectPanelProps) {
  const [injectedText, setInjectedText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = injectedText.trim();
    if (!trimmed || !isConnected) return;
    onSend(trimmed);
    setInjectedText("");
  }, [injectedText, isConnected, onSend]);

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          Type instead of talk
        </h2>
      </div>
      <div className="p-3.5">
        <div className="flex gap-2">
          <input
            id="bench_inject_input"
            type="text"
            placeholder="send as user turn"
            disabled={!isConnected}
            value={injectedText}
            onChange={(e) => setInjectedText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            className={`flex-1 ${inputClasses} disabled:opacity-40`}
          />
          <button
            onClick={handleSend}
            disabled={!isConnected}
            className="rounded-md border border-line bg-panel px-3.5 py-2 font-sans text-[13.5px] font-medium text-ink hover:border-ink3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}
