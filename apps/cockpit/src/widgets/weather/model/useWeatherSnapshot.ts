import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeatherDataState, WeatherLocation } from '@/widgets/weather/model/model.ts';
import { fetchWeatherData } from '@/widgets/weather/model/fetchWeatherData.ts';
import { getLogger } from '@/widgets/weather/log.ts';

//const WEATHER_REFRESH_INTERVAL_MS = 3 * 1000;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'unexpected weather request error.';
}

function getLocationDependencyKey(location: WeatherLocation): string {
  return `${location.id}:${location.label}:${location.latitude}:${location.longitude}:${location.timezone ?? 'auto'}`;
}

export function useWeatherSnapshot(location: WeatherLocation): WeatherDataState {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [state, setState] = useState<WeatherDataState>({ status: 'loading' });
  const previousLocationDependencyKeyRef = useRef(getLocationDependencyKey(location));

  const locationDependencyKey = getLocationDependencyKey(location);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [locationDependencyKey]);

  useEffect(() => {
    const abortController = new AbortController();
    const hasLocationChanged = previousLocationDependencyKeyRef.current !== locationDependencyKey;
    if (hasLocationChanged) {
      previousLocationDependencyKeyRef.current = locationDependencyKey;
      setState({ status: 'loading' });
    }

    const loadWeather = async () => {
      try {
        const weatherData = await fetchWeatherData({ data: location, signal: abortController.signal });
        setState({ status: 'loaded', weatherData, refresh });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        getLogger().error('weather-refresh-failed', { location }, error);
        setState({ status: 'error', errorMessage: toErrorMessage(error), refresh });
      }
    };

    void loadWeather();

    return () => abortController.abort();
  }, [location, locationDependencyKey, refresh, refreshVersion]);

  return state;
}
