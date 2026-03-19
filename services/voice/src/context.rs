use std::sync::Arc;

use crate::{config::Config, domain::service::VoiceTurnService};

#[derive(Clone)]
pub struct Context {
    pub config: Arc<Config>,
    pub voice_turn_service: VoiceTurnService,
}
