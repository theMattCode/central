CREATE SCHEMA IF NOT EXISTS service_weather;

CREATE TABLE IF NOT EXISTS service_weather.current_weather_snapshots (
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timezone TEXT NOT NULL,
  payload_version SMALLINT NOT NULL CHECK (payload_version > 0),
  current_payload JSONB NOT NULL,
  source_time TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (latitude, longitude)
);
