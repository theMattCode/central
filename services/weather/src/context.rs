use std::sync::Arc;

use crate::{config::Config, domain::service::WeatherSnapshotService};

#[derive(Clone)]
pub struct Context {
    pub config: Arc<Config>,
    pub weather_service: WeatherSnapshotService,
}
