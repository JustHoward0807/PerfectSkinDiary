const BASE = 'https://api.open-meteo.com/v1/forecast';

export interface UVWeatherData {
  uvIndex: number;
  sunrise: string;    // "HH:MM" in device-local time
  sunset: string;     // "HH:MM" in device-local time
  hourlyUV: number[]; // 24 values, index = hour of day
}

export interface UVLevel {
  label: string;
  spfRec: string;
  color: string;
}

export function getUVLevel(uv: number): UVLevel {
  if (uv <= 2)  return { label: 'Low',       spfRec: 'SPF 15 or as desired',      color: '#34C759' };
  if (uv <= 5)  return { label: 'Moderate',  spfRec: 'SPF 30+ recommended',       color: '#FFD60A' };
  if (uv <= 7)  return { label: 'High',      spfRec: 'SPF 50+ recommended',       color: '#FF9F0A' };
  if (uv <= 10) return { label: 'Very High', spfRec: 'SPF 50+, seek shade',       color: '#FF3B30' };
  return              { label: 'Extreme',   spfRec: 'SPF 50+, avoid midday sun',  color: '#BF5AF2' };
}

// 30-minute in-memory cache keyed by rounded lat/lon
const _cache = new Map<string, { data: UVWeatherData; ts: number }>();
const TTL_MS = 30 * 60 * 1000;

export async function fetchUVAndDaylight(lat: number, lon: number): Promise<UVWeatherData> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

  // timezone=auto → API returns all times in the coordinate's local timezone
  const url =
    `${BASE}?latitude=${lat}&longitude=${lon}` +
    `&hourly=uv_index&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const json = await res.json() as {
    hourly: { uv_index: number[] };
    daily:  { sunrise: string[]; sunset: string[] };
  };

  const hourlyUV = json.hourly.uv_index.slice(0, 24).map(v => Math.round(v * 10) / 10);
  const currentHour = new Date().getHours();
  const uvIndex = Math.round(hourlyUV[currentHour] ?? 0);

  // sunrise/sunset come back as "YYYY-MM-DDTHH:MM" — strip the date prefix
  const data: UVWeatherData = {
    uvIndex,
    sunrise: json.daily.sunrise[0].split('T')[1].slice(0, 5),
    sunset:  json.daily.sunset[0].split('T')[1].slice(0, 5),
    hourlyUV,
  };

  _cache.set(key, { data, ts: Date.now() });
  return data;
}
