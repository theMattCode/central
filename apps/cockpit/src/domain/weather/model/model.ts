export interface WeatherLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export const LOCATION_MOESSINGEN: WeatherLocation = {
  id: 'moessingen',
  label: 'Mössingen',
  latitude: 48.4057,
  longitude: 9.0542,
  timezone: 'Europe/Berlin',
};

export const LOCATION_OBERNHEIM: WeatherLocation = {
  id: 'obernheim',
  label: 'Obernheim',
  latitude: 48.163,
  longitude: 8.8611,
  timezone: 'Europe/Berlin',
};

export interface HourlyTemperaturePoint {
  timeIso: string;
  temperatureC: number;
}

export interface HourlyPrecipitationPoint {
  timeIso: string;
  rainMm: number;
  snowfallCm: number;
}

export interface CurrentWeather {
  weatherCode: number;
  temperatureC: number;
  temperatureApparentC: number;
  isDay: boolean;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  relativeHumidity: number;
  pressure: number;
  cloudCover: number;
}

export type WeatherData = Readonly<{
  location: WeatherLocation;
  current: Readonly<CurrentWeather>;
  /*
  hourlyTemperature: HourlyTemperaturePoint[];
  nextFourHoursPrecipitation: HourlyPrecipitationPoint[];
   */
}>;

export type WeatherDataLoading = {
  status: 'loading';
  data?: WeatherData;
};

export type WeatherDataLoaded = {
  status: 'loaded';
  weatherData: WeatherData;
  refresh: () => void;
};

export type WeatherDataError = {
  status: 'error';
  errorMessage: string;
  data?: WeatherData;
  refresh: () => void;
};

export type WeatherDataState = WeatherDataLoading | WeatherDataLoaded | WeatherDataError;
