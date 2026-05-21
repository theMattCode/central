/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogger } from '@/components/organisms/weather/log.ts';
import type { WeatherData, WeatherLocation } from '@/components/organisms/weather/model/model.ts';
import { fetchWeatherData } from '@/components/organisms/weather/model/fetchWeatherData.ts';
import { useWeatherSnapshot } from '@/components/organisms/weather/model/useWeatherSnapshot.ts';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/widgets/weather/model/fetchWeatherData.ts', () => ({
  fetchWeatherData: vi.fn(),
}));

vi.mock('@/widgets/weather/log.ts', () => ({
  getLogger: () => loggerMock,
}));

const WEATHER_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

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
  const loggerErrorMock = vi.mocked(getLogger().error);

  beforeEach(() => {
    loggerErrorMock.mockClear();
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

  it('returns an error state when the request fails', async () => {
    fetchWeatherDataMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { result } = renderHook(() => useWeatherSnapshot(TEST_LOCATION));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    if (result.current.status === 'error') {
      expect(result.current.errorMessage).toBe('fetch failed');
    }
    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'weather-refresh-failed',
      { location: TEST_LOCATION },
      expect.objectContaining({ message: 'fetch failed' }),
    );
  });

  it('refreshes weather data every 15 minutes', async () => {
    vi.useFakeTimers();

    renderHook(() => useWeatherSnapshot(TEST_LOCATION));

    await act(async () => {
      await Promise.resolve();
    });

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

  it('resets to loading and fetches again when the location changes', async () => {
    const nextLocation: WeatherLocation = {
      ...TEST_LOCATION,
      id: 'next-location',
      label: 'Next Location',
    };

    const { result, rerender } = renderHook(({ location }) => useWeatherSnapshot(location), {
      initialProps: { location: TEST_LOCATION },
    });

    await waitFor(() => {
      expect(result.current.status).toBe('loaded');
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1);

    rerender({ location: nextLocation });

    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('loaded');
    });

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2);
  });
});
