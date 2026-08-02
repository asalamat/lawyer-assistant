"use client";

import { useEffect, useState } from "react";
import { useTemperatureUnit } from "@/lib/useTemperatureUnit";

interface WeatherData {
  locationName: string;
  celsius: number;
  fahrenheit: number;
}

export default function WeatherDisplay() {
  const unit = useTemperatureUnit();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (unavailable || !weather) return null;

  const temp = unit === "F" ? weather.fahrenheit : weather.celsius;
  return (
    <span
      className="text-sm text-foreground/80"
      title={weather.locationName}
    >
      {temp}°{unit}
    </span>
  );
}
