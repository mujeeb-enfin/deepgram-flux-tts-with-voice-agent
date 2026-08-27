"use client";

import { useRef, useEffect } from "react";
import type { LogEntry } from "@/hooks/useDeepgramAgent";

interface EventLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

const levelClassMap: Record<string, string> = {
  hi: "text-ink font-medium",
  bad: "text-danger",
  "": "text-ink2",
};

export function EventLog({ entries, onClear }: EventLogProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries.length]);

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-panel">
      <div className="flex items-center justify-between gap-2.5 border-b border-line2 px-3.5 py-[11px]">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-widest text-ink2">
          Events
        </h2>
        <button
          onClick={onClear}
          className="rounded-md border border-line bg-panel px-2.5 py-1 font-sans text-xs text-ink hover:border-ink3"
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollContainerRef}
        className="max-h-[300px] overflow-y-auto px-3.5 py-2.5 font-mono text-[11.5px] leading-7"
      >
        {entries.length === 0 ? (
          <div className="font-mono text-[12.5px] text-ink3">ms since connect - server events</div>
        ) : (
          entries.map((entry, entryIndex) => (
            <div key={entryIndex} className="grid grid-cols-[66px_1fr] gap-2.5">
              <span className="text-right text-ink3">
                {String(entry.timestamp).padStart(5, " ")}
              </span>
              <span className={levelClassMap[entry.level] || "text-ink2"}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
