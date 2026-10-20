import { action, affects, createMemo, isPending, onSettled, refresh, type Accessor } from 'solid-js';
import type { WeatherData, WeatherLocation } from '@/domain/weather/model/model.ts';
import { fetchWeatherData } from '@/domain/weather/model/fetchWeatherData.ts';
import { getLogger } from '@/domain/weather/log.ts';

//const WEATHER_REFRESH_INTERVAL_MS = 3 * 1000;
const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

export type WeatherSnapshot = {
  data: Accessor<WeatherData>;
  isRefreshing: Accessor<boolean>;
  refresh: () => Promise<void>;
};

export function useWeatherSnapshot(location: Accessor<WeatherLocation>): WeatherSnapshot {
  const data = createMemo(
    async () => {
      const currentLocation = location();

      try {
        return await fetchWeatherData({ data: currentLocation });
      } catch (error) {
        getLogger().error('weather-refresh-failed', { location: currentLocation }, error);
        throw error;
      }
    },
    { name: 'weatherSnapshot' },
  );

  const refreshWeather = action(function* () {
    affects(data);
    yield refresh(data);
  });

  onSettled(() => {
    const intervalId = setInterval(() => {
      void refresh(data);
    }, WEATHER_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  });

  return {
    data,
    isRefreshing: () => isPending(() => data()),
    refresh: async () => void (await refreshWeather()),
  };
}
