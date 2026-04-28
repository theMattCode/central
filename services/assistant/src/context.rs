use std::sync::Arc;

use crate::{config::Config, domain::service::AssistantTurnService};

#[derive(Clone)]
pub struct Context {
    pub config: Arc<Config>,
    pub assistant_turn_service: AssistantTurnService,
}
