import { NextResponse } from "next/server";
import { geocodeLocation } from "@/lib/weather";
import { getWeatherLocation, setWeatherLocation } from "@/lib/settings";

export async function GET() {
  const location = (await getWeatherLocation()) ?? null;
  return NextResponse.json({ location });
}

export async function POST(request: Request) {
  const body = await request.json();
  const query = body?.query;
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const match = await geocodeLocation(query.trim());
    if (!match) {
      return NextResponse.json({ error: `No location found matching "${query}"` }, { status: 404 });
    }
    await setWeatherLocation(match);
    return NextResponse.json({ location: match });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Location lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
