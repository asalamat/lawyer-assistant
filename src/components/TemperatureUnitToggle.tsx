"use client";

import { useSyncExternalStore } from "react";

type Unit = "F" | "C";
const STORAGE_KEY = "temperatureUnit";

let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

function getSnapshot(): Unit {
  return (localStorage.getItem(STORAGE_KEY) as Unit | null) ?? "F";
}

function getServerSnapshot(): Unit {
  return "F";
}

function setUnit(unit: Unit) {
  localStorage.setItem(STORAGE_KEY, unit);
  listeners.forEach((listener) => listener());
}

export default function TemperatureUnitToggle() {
  const unit = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">Temperature unit</span>
      <div className="flex overflow-hidden rounded-full border border-border">
        {(["F", "C"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setUnit(option)}
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
