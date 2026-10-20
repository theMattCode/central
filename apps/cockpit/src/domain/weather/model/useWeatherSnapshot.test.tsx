/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, Errored, flush, Loading, type Accessor } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeatherData, WeatherLocation } from '@/domain/weather/model/model.ts';
import { fetchWeatherData } from '@/domain/weather/model/fetchWeatherData.ts';
import { useWeatherSnapshot } from '@/domain/weather/model/useWeatherSnapshot.ts';

vi.mock('@/domain/weather/model/fetchWeatherData.ts', () => ({
  fetchWeatherData: vi.fn(),
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

  beforeEach(() => {
    fetchWeatherDataMock.mockReset();
    fetchWeatherDataMock.mockResolvedValue(TEST_WEATHER_DATA);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('loads weather data through a loading boundary', async () => {
    renderWeather(() => TEST_LOCATION);

    expect(screen.getByText('Loading weather...')).toBeDefined();
    expect(await screen.findByText('20')).toBeDefined();
    expect(fetchWeatherDataMock).toHaveBeenCalledWith({ data: TEST_LOCATION });
  });

  it('routes request failures to an error boundary', async () => {
    fetchWeatherDataMock.mockRejectedValueOnce(new Error('fetch failed'));

    renderWeather(() => TEST_LOCATION);

    expect(await screen.findByText('fetch failed')).toBeDefined();
  });

  it('refreshes weather data every 15 minutes', async () => {
    vi.useFakeTimers();
    renderWeather(() => TEST_LOCATION);
    await vi.waitFor(() => expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2));

    await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS);
    await vi.waitFor(() => expect(fetchWeatherDataMock).toHaveBeenCalledTimes(3));
  });

  it('keeps existing data visible while a refresh is in flight', async () => {
    vi.useFakeTimers();
    renderWeather(() => TEST_LOCATION);
    await vi.waitFor(() => expect(fetchWeatherDataMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    flush();
    expect(screen.getByText('20')).toBeDefined();

    fetchWeatherDataMock.mockImplementationOnce(() => new Promise<WeatherData>(() => undefined));
    await vi.advanceTimersByTimeAsync(WEATHER_REFRESH_INTERVAL_MS);

    expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('20')).toBeDefined();
  });

  it('fetches again when the location changes', async () => {
    const nextLocation: WeatherLocation = { ...TEST_LOCATION, id: 'next-location', label: 'Next Location' };
    const nextWeather = { ...TEST_WEATHER_DATA, location: nextLocation };
    fetchWeatherDataMock.mockResolvedValueOnce(TEST_WEATHER_DATA).mockResolvedValueOnce(nextWeather);
    const [location, setLocation] = createSignal(TEST_LOCATION);
    renderWeather(location);
    expect(await screen.findByText('20')).toBeDefined();

    setLocation(nextLocation);
    flush();

    await waitFor(() => expect(fetchWeatherDataMock).toHaveBeenCalledTimes(2));
    expect(fetchWeatherDataMock).toHaveBeenLastCalledWith({ data: nextLocation });
  });
});

function renderWeather(location: Accessor<WeatherLocation>) {
  return render(() => {
    const weather = useWeatherSnapshot(location);
    return (
      <Errored fallback={(error) => <span>{String((error() as Error).message)}</span>}>
        <Loading fallback={<span>Loading weather...</span>}>
          <span>{weather.data().current.temperatureC}</span>
          <button onClick={() => void weather.refresh()} type="button">
            Refresh
          </button>
        </Loading>
      </Errored>
    );
  });
}
