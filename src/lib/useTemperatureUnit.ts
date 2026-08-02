"use client";

import { useSyncExternalStore } from "react";

export type TemperatureUnit = "F" | "C";
const STORAGE_KEY = "temperatureUnit";

let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

function getSnapshot(): TemperatureUnit {
  return (localStorage.getItem(STORAGE_KEY) as TemperatureUnit | null) ?? "F";
}

function getServerSnapshot(): TemperatureUnit {
  return "F";
}

export function setTemperatureUnit(unit: TemperatureUnit) {
  localStorage.setItem(STORAGE_KEY, unit);
  listeners.forEach((listener) => listener());
}

export function useTemperatureUnit(): TemperatureUnit {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
