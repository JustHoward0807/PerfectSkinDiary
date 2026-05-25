import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { fetchUVAndDaylight, getUVLevel, type UVLevel } from '../services/uvWeather';

export type Greeting = 'Good Morning' | 'Good Afternoon' | 'Good Evening';

function clockGreeting(): Greeting {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

// Uses actual sunset time to decide when "Good Evening" begins
function greetingFromSunset(sunsetHHMM: string): Greeting {
  const now = new Date();
  const h = now.getHours();
  if (h < 12) return 'Good Morning';
  const [sh, sm] = sunsetHHMM.split(':').map(Number);
  const nowMin = h * 60 + now.getMinutes();
  const sunsetMin = sh * 60 + sm;
  return nowMin < sunsetMin ? 'Good Afternoon' : 'Good Evening';
}

export interface WeatherState {
  greeting: Greeting;
  uvIndex: number;
  uvLevel: UVLevel;
  sunrise: string;         // "HH:MM" or "" while loading
  sunset: string;          // "HH:MM" or "" while loading
  hourlyUV: number[];
  loading: boolean;
  permissionDenied: boolean;
  // Re-derive greeting + current-hour UV from cached data without a network call
  refresh: () => void;
}

export function useWeather(): WeatherState {
  const [state, setState] = useState<Omit<WeatherState, 'refresh'>>({
    greeting: clockGreeting(),
    uvIndex: 0,
    uvLevel: getUVLevel(0),
    sunrise: '',
    sunset: '',
    hourlyUV: [],
    loading: true,
    permissionDenied: false,
  });

  const refresh = useCallback(() => {
    setState(prev => {
      const h = new Date().getHours();
      const uvIdx = Math.round(prev.hourlyUV[h] ?? 0);
      return {
        ...prev,
        greeting: prev.sunset ? greetingFromSunset(prev.sunset) : clockGreeting(),
        uvIndex: uvIdx,
        uvLevel: getUVLevel(uvIdx),
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (!cancelled) setState(prev => ({
          ...prev,
          loading: false,
          permissionDenied: true,
        }));
        return;
      }

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const data = await fetchUVAndDaylight(pos.coords.latitude, pos.coords.longitude);

        if (!cancelled) setState({
          greeting: greetingFromSunset(data.sunset),
          uvIndex: data.uvIndex,
          uvLevel: getUVLevel(data.uvIndex),
          sunrise: data.sunrise,
          sunset: data.sunset,
          hourlyUV: data.hourlyUV,
          loading: false,
          permissionDenied: false,
        });
      } catch {
        if (!cancelled) setState(prev => ({ ...prev, greeting: clockGreeting(), loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { ...state, refresh };
}
