// Open-Meteo — free, no API key required for non-commercial use.
// https://open-meteo.com/en/docs and /en/docs/geocoding-api

export interface GeocodedLocation {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

export async function geocodeLocation(query: string): Promise<GeocodedLocation | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding lookup failed: ${res.status}`);
  const data = (await res.json()) as {
    results?: { name: string; country?: string; latitude: number; longitude: number }[];
  };
  const match = data.results?.[0];
  if (!match) return null;
  return {
    name: match.name,
    country: match.country ?? null,
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

export async function getCurrentTemperature(
  latitude: number,
  longitude: number,
  unit: "fahrenheit" | "celsius",
): Promise<number> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m");
  url.searchParams.set("temperature_unit", unit);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather lookup failed: ${res.status}`);
  const data = (await res.json()) as { current?: { temperature_2m?: number } };
  if (typeof data.current?.temperature_2m !== "number") {
    throw new Error("Weather response missing temperature");
  }
  return data.current.temperature_2m;
}
