pub mod accounts;
pub mod balances;
pub mod budgets;
pub mod categories;
pub mod contracts;
pub mod dashboard;
pub mod http;
pub mod ledger;
pub mod model;
pub mod repository;
pub mod recurring;
pub mod service;

#[cfg(test)]
mod http_tests;

use axum::{
  routing::{delete, get, post, put},
  Router,
};

use crate::context::Context;

pub fn router() -> Router<Context> {
  Router::new()
    .route("/transactions", get(http::list_transactions))
    .route("/transactions", post(http::create_transaction))
    .route("/transactions/{id}", put(http::update_transaction))
    .route("/transactions/{id}", delete(http::delete_transaction))
}
