import { createServerFn } from '@tanstack/react-start';
import { getLogger } from '@/widgets/weather/log.ts';
import type { WeatherData, WeatherLocation } from './model.ts';
import { resolveBackendBaseUrl } from './backendBaseUrl.ts';

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

function createWeatherServiceUrl(baseUrl: string, path: string, location: WeatherLocation): URL {
  const url = new URL(path, baseUrl);
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

  return `Backend weather request failed with status ${response.status}.`;
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

export function validateWeatherLocation(input: unknown): WeatherLocation {
  if (!input || typeof input !== 'object') {
    getLogger().error('invalid-location-payload', { payload: input });
    throw new Error('Invalid weather location payload.');
  }

  const location = input as Partial<WeatherLocation>;

  if (
    typeof location.id !== 'string' ||
    typeof location.label !== 'string' ||
    typeof location.latitude !== 'number' ||
    typeof location.longitude !== 'number' ||
    (location.timezone !== undefined && typeof location.timezone !== 'string')
  ) {
    getLogger().error('invalid-location-payload', { payload: input });
    throw new Error('Invalid weather location payload.');
  }

  return {
    id: location.id,
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
  };
}

async function requestWeatherData(location: WeatherLocation): Promise<WeatherData> {
  const baseUrl = resolveBackendBaseUrl();
  const url = createWeatherServiceUrl(baseUrl, 'api/v1/weather/current', location);

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    getLogger().error('request-current-weather-failed', { url: url.toString(), location }, error);
    throw new Error(error instanceof Error && error.message ? error.message : 'Failed to fetch weather data');
  }
  if (!response.ok) {
    const message = await toErrorMessage(response);
    getLogger().error(
      'request-current-weather-response-error',
      {
        ...{ url: url.toString(), location },
        status: response.status,
        statusText: response.statusText,
      },
      message,
    );
    throw new Error(message);
  }

  const snapshot = (await response.json()) as WeatherServiceSnapshot;

  getLogger().info('requested current weather', { url: url.toString(), location: location.label });
  return toWeatherData(location, snapshot);
}

export const fetchWeatherData = createServerFn({ method: 'GET' })
  .inputValidator(validateWeatherLocation)
  .handler(async ({ data }) => requestWeatherData(data));
