use super::WeatherQueryInput;

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
