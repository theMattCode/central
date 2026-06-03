use std::sync::Arc;

use crate::config::Config;
use crate::domains::finance::service::FinanceService;
use crate::domains::weather::service::WeatherService;

#[derive(Clone)]
pub struct Context {
  pub config: Arc<Config>,
  pub finance_service: FinanceService,
  pub weather_service: WeatherService,
}
