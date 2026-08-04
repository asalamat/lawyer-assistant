"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sidebarCollapsed";

let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

export function setSidebarCollapsed(collapsed: boolean) {
  localStorage.setItem(STORAGE_KEY, String(collapsed));
  listeners.forEach((listener) => listener());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
