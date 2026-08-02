"use client";

import { useState } from "react";
import type { WeatherLocation } from "@/lib/settings";

export default function WeatherLocationForm({
  initialLocation,
}: {
  initialLocation: WeatherLocation | null;
}) {
  const [location, setLocation] = useState(initialLocation);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save location");
      setLocation(body.location);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-3 text-sm">
        <span>Weather location</span>
        <span className="text-muted">
          {location ? `${location.name}${location.country ? `, ${location.country}` : ""}` : "Not set"}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City name (e.g. Toronto)"
          className="surface-input flex-1"
        />
        <button type="submit" disabled={saving || !query.trim()} className="btn-secondary">
          {saving ? "Looking up…" : "Set location"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
