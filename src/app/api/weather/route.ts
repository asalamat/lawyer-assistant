import { NextResponse } from "next/server";
import { getCurrentTemperature } from "@/lib/weather";
import { getWeatherLocation } from "@/lib/settings";

export async function GET() {
  const location = await getWeatherLocation();
  if (!location) {
    return NextResponse.json({ error: "No location configured" }, { status: 404 });
  }

  try {
    const celsius = await getCurrentTemperature(location.latitude, location.longitude, "celsius");
    return NextResponse.json({
      locationName: location.name,
      celsius: Math.round(celsius),
      fahrenheit: Math.round((celsius * 9) / 5 + 32),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
