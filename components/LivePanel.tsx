"use client";

import { useRef, useEffect } from "react";
import type { TranscriptTurn } from "@/hooks/useDeepgramAgent";
import { VuMeter } from "./VuMeter";
import { TurnTape } from "./TurnTape";

interface LivePanelProps {
  currentPhase: string;
  userLevel: number;
  agentLevel: number;
  turns: TranscriptTurn[];
}

export function LivePanel({ currentPhase, userLevel, agentLevel, turns }: LivePanelProps) {
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [turns.length]);

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          Live
        </h2>
        <span className="font-mono text-[11px] tracking-wide text-ink2">{currentPhase}</span>
      </div>

      <div className="grid grid-cols-2 gap-3.5 border-b border-line2 px-3.5 py-3">
        <VuMeter label="You" level={userLevel} variant="user" />
        <VuMeter label="Agent" level={agentLevel} variant="agent" />
      </div>

      <TurnTape turns={turns} />

      <div ref={transcriptScrollRef} className="max-h-[340px] overflow-y-auto px-3.5 py-1.5">
        {turns.length === 0 ? (
          <div className="py-3.5 font-mono text-[12.5px] text-ink3">Transcript appears here.</div>
        ) : (
          turns.map((turn, turnIndex) => (
            <div
              key={turnIndex}
              className="border-b border-line2 py-2 last:border-b-0"
            >
              <div
                className={`font-mono text-[10px] uppercase tracking-widest ${
                  turn.role === "user" ? "text-signal" : "text-live"
                }`}
              >
                {turn.role === "user" ? "you" : "agent"}
              </div>
              <p className="mt-0.5 text-sm">
                {turn.text}
                {turn.wasCutOff && (
                  <span className="ml-1.5 inline-block rounded-sm border border-cutmark-border px-1 font-mono text-[10px] text-warn">
                    cut off
                  </span>
                )}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
