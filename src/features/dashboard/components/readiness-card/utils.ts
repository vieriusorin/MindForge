import type { LucideIcon } from "lucide-react";
import { CloudFog, CloudRain, CloudSun, Sun } from "lucide-react";
import type { Weather } from "@/engine/readiness";

interface WeatherDisplay {
  label: string;
  icon: LucideIcon;
  badge: "default" | "secondary" | "destructive" | "outline";
}

/** ui-design §5: every weather carries its word; the icon and badge colour only repeat it. */
export const WEATHER_DISPLAY = {
  sunny: { label: "Sunny", icon: Sun, badge: "default" },
  cloudy: { label: "Cloudy", icon: CloudSun, badge: "secondary" },
  rain: { label: "Rain", icon: CloudRain, badge: "destructive" },
  fog: { label: "Fog", icon: CloudFog, badge: "outline" },
} as const satisfies Record<Weather, WeatherDisplay>;

/** The memory half of a domain's meta line. */
export function forecastLabel(forecastPercent: number | null): string {
  return forecastPercent === null
    ? "Not studied yet"
    : `Memory forecast ${forecastPercent}%`;
}

/** The storm half of a domain's meta line (MF-0015 SC-2: "no storm yet"). */
export function stormLabel(stormPercent: number | null): string {
  return stormPercent === null ? "No storm yet" : `Last storm ${stormPercent}%`;
}

/** The overall line; null overall means every domain is fog. */
export function overallLabel(overallPercent: number | null): string {
  return overallPercent === null ? "No data yet" : `${overallPercent}%`;
}
