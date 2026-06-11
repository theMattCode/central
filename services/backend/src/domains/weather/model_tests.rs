use super::{
    WeatherForecastQueryInput, WeatherQueryInput, DEFAULT_FORECAST_HOURS_FUTURE,
    DEFAULT_FORECAST_HOURS_PAST, MAX_FORECAST_HOURS_FUTURE, MAX_FORECAST_HOURS_PAST,
};

#[test]
fn query_requires_lat_lon() {
    let missing_lat = WeatherQueryInput {
        lat: None,
        lon: Some(10.0),
        timezone: None,
    };

    let missing_lon = WeatherQueryInput {
        lat: Some(10.0),
        lon: None,
        timezone: None,
    };

    assert!(missing_lat.into_location().is_err());
    assert!(missing_lon.into_location().is_err());
}

#[test]
fn query_validates_coordinate_ranges() {
    let invalid_lat = WeatherQueryInput {
        lat: Some(100.0),
        lon: Some(10.0),
        timezone: None,
    };

    let invalid_lon = WeatherQueryInput {
        lat: Some(10.0),
        lon: Some(200.0),
        timezone: None,
    };

    assert!(invalid_lat.into_location().is_err());
    assert!(invalid_lon.into_location().is_err());
}

#[test]
fn query_defaults_timezone_to_auto() {
    let query = WeatherQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: None,
    };

    let location = query.into_location().expect("query should be valid");
    assert_eq!(location.timezone, "auto");
}

#[test]
fn query_uses_provided_timezone() {
    let query = WeatherQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: Some("Europe/Berlin".to_string()),
    };

    let location = query.into_location().expect("query should be valid");
    assert_eq!(location.timezone, "Europe/Berlin");
}

#[test]
fn forecast_query_defaults_hours_and_timezone() {
    let query = WeatherForecastQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: None,
        hours_past: None,
        hours_future: None,
    };

    let forecast_query = query.into_forecast_query().expect("query should be valid");
    assert_eq!(forecast_query.location.timezone, "auto");
    assert_eq!(forecast_query.hours_past, DEFAULT_FORECAST_HOURS_PAST);
    assert_eq!(forecast_query.hours_future, DEFAULT_FORECAST_HOURS_FUTURE);
}

#[test]
fn forecast_query_validates_hour_ranges() {
    let too_large_past = WeatherForecastQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: None,
        hours_past: Some(MAX_FORECAST_HOURS_PAST + 1),
        hours_future: Some(10),
    };
    let too_large_future = WeatherForecastQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: None,
        hours_past: Some(10),
        hours_future: Some(MAX_FORECAST_HOURS_FUTURE + 1),
    };

    assert!(too_large_past.into_forecast_query().is_err());
    assert!(too_large_future.into_forecast_query().is_err());
}

#[test]
fn forecast_query_requires_non_zero_window() {
    let query = WeatherForecastQueryInput {
        lat: Some(48.4057),
        lon: Some(9.0542),
        timezone: Some("Europe/Berlin".to_string()),
        hours_past: Some(0),
        hours_future: Some(0),
    };

    assert!(query.into_forecast_query().is_err());
}
