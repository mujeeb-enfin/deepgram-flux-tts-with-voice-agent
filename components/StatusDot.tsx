"use client";

import type { ConnectionState } from "@/hooks/useDeepgramAgent";

const dotColorMap: Record<ConnectionState, string> = {
  idle: "bg-ink3",
  connecting: "bg-warn",
  live: "bg-live",
  error: "bg-danger",
};

const labelMap: Record<ConnectionState, string> = {
  idle: "idle",
  connecting: "connecting",
  live: "live",
  error: "error",
};

interface StatusDotProps {
  connectionState: ConnectionState;
}

export function StatusDot({ connectionState }: StatusDotProps) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-ink2">
      <span className={`h-[7px] w-[7px] flex-none rounded-full ${dotColorMap[connectionState]}`} />
      <span>{labelMap[connectionState]}</span>
    </span>
  );
}
