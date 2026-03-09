/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherData, WeatherLocation } from '@/widgets/weather/model/model.ts';
import { fetchWeatherData } from '@/widgets/weather/model/fetchWeatherData.ts';
import { useWeatherSnapshot } from '@/widgets/weather/model/useWeatherSnapshot.ts';

vi.mock('@/widgets/weather/model/fetchWeatherData.ts', () => ({
  fetchWeatherData: vi.fn(),
}));

const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const TEST_LOCATION: WeatherLocation = {
  id: 'test-location',
  label: 'Test Location',
  latitude: 1,
  longitude: 2,
  timezone: 'Europe/Berlin',
};

const TEST_WEATHER_DATA: WeatherData = {
  location: TEST_LOCATION,
  current: {
    weatherCode: 0,
    temperatureC: 20,
    temperatureApparentC: 19,
    isDay: true,
    precipitation: 0,
    relativeHumidity: 50,
    windSpeed: 12,
    windDirection: 180,
    pressure: 1013,
    cloudCover: 25,
  },
};

describe('useWeatherSnapshot', () => {
  const fetchWeatherDataMock = vi.mocked(fetchWeatherData);

  beforeEach(() => {
    fetchWeatherDataMock.mockResolvedValue(TEST_WEATHER_DATA);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('loads weather data on mount', async () => {
    const { result } = renderHook(() => useWeatherSnapshot(TEST_LOCATION));

    await waitFor(() => {
      expect(result.current.status).toBe('loaded');
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes weather data every 5 minutes', async () => {
    vi.useFakeTimers();

    renderHook(() => useWeatherSnapshot(TEST_LOCATION));

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS - 1);
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2);
  });

  it('keeps existing data visible while a refresh request is in flight', async () => {
    vi.useFakeTimers();

    let resolveFetch: ((value: WeatherData) => void) | undefined;
    fetchWeatherDataMock.mockImplementationOnce(
      () =>
        new Promise<WeatherData>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() => useWeatherSnapshot(TEST_LOCATION));

    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolveFetch?.(TEST_WEATHER_DATA);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('loaded');

    fetchWeatherDataMock.mockImplementationOnce(
      () =>
        new Promise<WeatherData>(() => {
          // Keep this refresh unresolved so we can assert the transient state.
        }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS);
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('loaded');
  });
});
