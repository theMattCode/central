CREATE SCHEMA IF NOT EXISTS service_weather;

CREATE TABLE IF NOT EXISTS service_weather.hourly_weather_forecasts (
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timezone TEXT NOT NULL,
  forecast_at_utc TIMESTAMPTZ NOT NULL,
  weather_code INTEGER NOT NULL,
  temperature_c DOUBLE PRECISION NOT NULL,
  temperature_apparent_c DOUBLE PRECISION NOT NULL,
  is_day BOOLEAN NOT NULL,
  precipitation_mm DOUBLE PRECISION NOT NULL,
  rain_mm DOUBLE PRECISION NOT NULL,
  snowfall_cm DOUBLE PRECISION NOT NULL,
  relative_humidity_pct DOUBLE PRECISION NOT NULL,
  wind_speed_kmh DOUBLE PRECISION NOT NULL,
  wind_gusts_kmh DOUBLE PRECISION NOT NULL,
  wind_direction_deg DOUBLE PRECISION NOT NULL,
  pressure_msl_hpa DOUBLE PRECISION NOT NULL,
  cloud_cover_pct DOUBLE PRECISION NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (latitude, longitude, forecast_at_utc)
);

CREATE INDEX IF NOT EXISTS idx_hourly_weather_forecasts_location_time
  ON service_weather.hourly_weather_forecasts (latitude, longitude, forecast_at_utc DESC);
