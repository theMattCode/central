import { fetchWeatherApi } from 'openmeteo';
import type { WeatherData, WeatherLocation } from '@/widgets/weather/model/model.ts';

const OPEN_METEO_DWD_URL = 'https://api.open-meteo.com/v1/dwd-icon';

const DEFAULT_PARAMS = {
  /*
  daily: [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'apparent_temperature_min',
    'sunrise',
    'sunset',
    'daylight_duration',
    'sunshine_duration',
  ],
  hourly: [
    'temperature_2m',
    'rain',
    'showers',
    'snowfall',
    'wind_speed_10m',
    'wind_speed_80m',
    'wind_speed_120m',
    'wind_speed_180m',
    'wind_direction_10m',
    'temperature_80m',
  ],
   */
  current: [
    'weather_code',
    'temperature_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'relative_humidity_2m',
    'wind_speed_10m',
    'wind_direction_10m',
    'pressure_msl',
    'cloud_cover',
  ],
  timezone: 'Europe/Berlin',
};

export async function fetchWeatherData(location: WeatherLocation, signal?: AbortSignal): Promise<WeatherData> {
  const params = { ...DEFAULT_PARAMS, latitude: location.latitude, longitude: location.longitude };

  const responses = await fetchWeatherApi(OPEN_METEO_DWD_URL, params, 0, 0, 0, { signal });
  if (responses.length === 0) {
    throw new Error(`Open-Meteo request failed: no data received.`);
  }

  // Return first location. Loop for multiple locations or weather models when necessary.
  const response = responses[0];

  const current = response.current();
  if (!current) {
    throw new Error(`Open-Meteo request failed: no current weather data received.`);
  }

  /*
  const daily = response.daily();
  if (!daily) {
    throw new Error(`Open-Meteo request failed: no daily weather data received.`);
  }

  const hourly = response.hourly();
  if (!hourly) {
    throw new Error(`Open-Meteo request failed: no hourly weather data received.`);
  }
   */

  return {
    location,
    current: {
      weatherCode: current.variables(0)?.value() ?? Number.NaN,
      temperatureC: current.variables(1)?.value() ?? Number.NaN,
      temperatureApparentC: current.variables(2)?.value() ?? Number.NaN,
      isDay: current.variables(3)?.value() === 1,
      precipitation: current.variables(4)?.value() ?? Number.NaN,
      relativeHumidity: current.variables(5)?.value() ?? Number.NaN,
      windSpeed: current.variables(6)?.value() ?? Number.NaN,
      windDirection: current.variables(7)?.value() ?? Number.NaN,
      pressure: current.variables(8)?.value() ?? Number.NaN,
      cloudCover: current.variables(9)?.value() ?? Number.NaN,
    },
  };
}
