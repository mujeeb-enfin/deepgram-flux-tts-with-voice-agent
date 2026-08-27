"use client";

import { useRef, useEffect } from "react";
import type { TranscriptTurn } from "@/hooks/useDeepgramAgent";

interface TurnTapeProps {
  turns: TranscriptTurn[];
}

export function TurnTape({ turns }: TurnTapeProps) {
  const tapeContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tapeContainerRef.current) {
      tapeContainerRef.current.scrollLeft = tapeContainerRef.current.scrollWidth;
    }
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex min-h-[38px] items-center gap-1 overflow-x-auto border-b border-line2 px-3.5 py-2.5">
        <span className="font-mono text-[10.5px] text-ink3">
          turn tape — each block is one turn, amber means you cut it off
        </span>
      </div>
    );
  }

  return (
    <div
      ref={tapeContainerRef}
      className="flex min-h-[38px] items-center gap-[3px] overflow-x-auto border-b border-line2 px-3.5 py-2.5"
    >
      {turns.map((turn, turnIndex) => {
        const segmentWidth = Math.min(120, 10 + turn.text.length * 0.6);
        let segmentColor = turn.role === "user" ? "bg-seg-user" : "bg-seg-agent";
        if (turn.wasCutOff) segmentColor = "bg-seg-cut";
        return (
          <div
            key={turnIndex}
            className={`h-4 flex-none rounded-sm ${segmentColor}`}
            style={{ minWidth: "8px", width: `${segmentWidth}px` }}
            title={turn.text}
          />
        );
      })}
    </div>
  );
}
