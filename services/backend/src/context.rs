use std::sync::Arc;

use crate::{config::Config, domains::weather::domain::service::WeatherSnapshotService};

#[derive(Clone)]
pub struct Context {
    pub config: Arc<Config>,
    pub weather_service: WeatherSnapshotService,
}
