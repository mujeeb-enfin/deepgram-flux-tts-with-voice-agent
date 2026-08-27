"use client";

interface VuMeterProps {
  label: string;
  level: number;
  variant: "user" | "agent";
}

export function VuMeter({ label, level, variant }: VuMeterProps) {
  const fillColor = variant === "user" ? "bg-signal" : "bg-live";
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-ink3">
        {label}
      </div>
      <div className="h-[5px] overflow-hidden rounded-sm bg-line2">
        <div
          className={`h-full rounded-sm transition-[width] duration-[60ms] linear ${fillColor}`}
          style={{ width: `${level * 100}%` }}
        />
      </div>
    </div>
  );
}
