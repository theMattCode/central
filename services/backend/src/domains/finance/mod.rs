pub mod accounts;
pub mod balances;
pub mod budgets;
pub mod categories;
pub mod contracts;
pub mod dashboard;
pub mod http;
pub mod ledger;
pub mod model;
pub mod recurring;
pub mod repository;
pub mod service;

#[cfg(test)]
mod http_tests;
#[cfg(test)]
mod repository_tests;

use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::context::Context;

pub fn router() -> Router<Context> {
    Router::new()
        .route("/accounts", get(http::list_financial_accounts))
        .route("/accounts", post(http::create_financial_account))
        .route("/accounts/{id}", put(http::update_financial_account))
        .route(
            "/accounts/{id}/archive",
            post(http::archive_financial_account),
        )
        .route(
            "/accounts/{id}/restore",
            post(http::restore_financial_account),
        )
        .route("/transactions", get(http::list_transactions))
        .route("/transactions", post(http::create_transaction))
        .route("/transactions/{id}", put(http::update_transaction))
        .route("/transactions/{id}", delete(http::delete_transaction))
}
