import type { WeatherData, WeatherLocation } from '@/widgets/weather/model/model.ts';

const WEATHER_SERVICE_BASE_URL = import.meta.env.VITE_WEATHER_API_BASE_URL ?? 'http://localhost:3010';

type WeatherServiceSnapshot = {
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  current: {
    weatherCode: number;
    temperatureC: number;
    temperatureApparentC: number;
    isDay: boolean;
    precipitation: number;
    relativeHumidity: number;
    windSpeed: number;
    windDirection: number;
    pressure: number;
    cloudCover: number;
  };
};

type WeatherServiceError = {
  error?: {
    message?: string;
  };
};

function createWeatherServiceUrl(path: string, location: WeatherLocation): URL {
  const url = new URL(path, WEATHER_SERVICE_BASE_URL);
  url.searchParams.set('lat', location.latitude.toString());
  url.searchParams.set('lon', location.longitude.toString());

  if (location.timezone) {
    url.searchParams.set('timezone', location.timezone);
  }

  return url;
}

async function toErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as WeatherServiceError;
    const message = payload.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // ignore JSON parse errors and return generic fallback below
  }

  return `Weather service request failed with status ${response.status}.`;
}

function toWeatherData(location: WeatherLocation, snapshot: WeatherServiceSnapshot): WeatherData {
  return {
    location: {
      ...location,
      latitude: snapshot.location.latitude,
      longitude: snapshot.location.longitude,
      timezone: snapshot.location.timezone,
    },
    current: {
      weatherCode: snapshot.current.weatherCode,
      temperatureC: snapshot.current.temperatureC,
      temperatureApparentC: snapshot.current.temperatureApparentC,
      isDay: snapshot.current.isDay,
      precipitation: snapshot.current.precipitation,
      relativeHumidity: snapshot.current.relativeHumidity,
      windSpeed: snapshot.current.windSpeed,
      windDirection: snapshot.current.windDirection,
      pressure: snapshot.current.pressure,
      cloudCover: snapshot.current.cloudCover,
    },
  };
}

export async function fetchWeatherData(location: WeatherLocation, signal?: AbortSignal): Promise<WeatherData> {
  const url = createWeatherServiceUrl('/api/v1/weather/current', location);

  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(await toErrorMessage(response));
  }

  const snapshot = (await response.json()) as WeatherServiceSnapshot;
  return toWeatherData(location, snapshot);
}
