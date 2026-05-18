use std::sync::Arc;

use crate::{
    config::Config,
    domains::{
        finance::domain::service::FinanceService, weather::domain::service::WeatherSnapshotService,
    },
};

#[derive(Clone)]
pub struct Context {
    pub config: Arc<Config>,
    pub finance_service: FinanceService,
    pub weather_service: WeatherSnapshotService,
}
