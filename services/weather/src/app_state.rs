use std::sync::Arc;

use crate::{config::Config, weather::provider::OpenMeteoClient};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub open_meteo: OpenMeteoClient,
}
