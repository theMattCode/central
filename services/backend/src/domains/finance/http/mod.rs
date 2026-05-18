mod handlers;

use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::context::Context;

pub fn router() -> Router<Context> {
    Router::new()
        .route("/transactions", get(handlers::list_transactions))
        .route("/transactions", post(handlers::create_transaction))
        .route("/transactions/{id}", put(handlers::update_transaction))
        .route("/transactions/{id}", delete(handlers::delete_transaction))
}

#[cfg(test)]
mod tests;
