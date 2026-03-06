import { useCallback, useEffect, useState } from 'react';
import type { WeatherDataState, WeatherLocation } from '@/widgets/weather/model/model.ts';
import { fetchWeatherData } from '@/widgets/weather/model/open-meteo.ts';

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

  const [state, setState] = useState<WeatherDataState>(() => ({ status: 'loading' }));

  const locationDependencyKey = getLocationDependencyKey(location);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    setState({ status: 'loading' });

    const loadWeather = async () => {
      try {
        const weatherData = await fetchWeatherData(location, abortController.signal);
        setState({ status: 'loaded', weatherData, refresh });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }
        setState({ status: 'error', errorMessage: toErrorMessage(error), refresh });
      }
    };

    void loadWeather();

    return () => abortController.abort();
  }, [locationDependencyKey, refreshVersion]);

  return state;
}
