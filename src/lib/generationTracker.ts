// In-memory tracking of AI generations currently running, keyed by
// "<sourceType>:<matterId>" — a real request-coalescing pattern, not just a
// UI flag: a second POST for the same matter+feature while one is already
// running gets the exact same in-flight promise instead of starting a
// duplicate (expensive) AI call. Deliberately in-memory rather than a DB
// table — this is a single-process, self-hosted app, and the whole point is
// tracking work that's live in THIS process right now; nothing here needs
// to survive a restart (a restart kills the in-flight generation anyway).
const inFlight = new Map<string, Promise<unknown>>();

export function generationKey(sourceType: string, matterId: string): string {
  return `${sourceType}:${matterId}`;
}

export function trackGeneration<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = run().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

export function isGenerating(key: string): boolean {
  return inFlight.has(key);
}
