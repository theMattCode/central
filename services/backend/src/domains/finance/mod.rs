pub mod accounts;
pub mod balances;
pub mod budgets;
pub mod categories;
pub mod dashboard;
pub mod http;
pub mod ledger;
pub mod model;
pub mod recurring;
pub mod repository;
pub mod service;
mod validation;

#[cfg(test)]
mod http_tests;

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
    .route("/accounts/{id}/archive", post(http::archive_financial_account))
    .route("/transactions", get(http::list_transactions))
    .route("/transactions", post(http::create_transaction))
    .route("/transactions/{id}", put(http::update_transaction))
    .route("/transactions/{id}", delete(http::delete_transaction))
}

#[cfg(test)]
pub(crate) fn in_memory_finance_service() -> service::FinanceService {
  service::FinanceService::new(std::sync::Arc::new(repository::FinanceRepository::in_memory()))
}
