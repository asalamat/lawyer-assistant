"use client";

import { setTemperatureUnit, useTemperatureUnit } from "@/lib/useTemperatureUnit";

export default function TemperatureUnitToggle() {
  const unit = useTemperatureUnit();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">Temperature unit</span>
      <div className="flex overflow-hidden rounded-full border border-border">
        {(["F", "C"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTemperatureUnit(option)}
            className={`px-3 py-1 text-sm transition-colors ${
              unit === option ? "bg-accent text-accent-foreground" : "text-muted hover:text-accent"
            }`}
          >
            °{option}
          </button>
        ))}
      </div>
    </div>
  );
}
