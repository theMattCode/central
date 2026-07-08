use axum::{
  extract::{Path, Query, State},
  http::StatusCode,
  Json,
};

use crate::domains::finance::model::{
  FinancialAccountInput, FinancialAccountListResponse, FinancialAccountResponse, TransactionInput,
  TransactionListResponse, TransactionResponse, TransactionsQueryInput,
};
use crate::{context::Context, error::ApiError};

pub(in crate::domains::finance) async fn list_financial_accounts(
  State(context): State<Context>,
) -> Result<Json<FinancialAccountListResponse>, ApiError> {
  let response = context.finance_service.list_financial_accounts().await?;
  Ok(Json(response))
}

pub(in crate::domains::finance) async fn create_financial_account(
  State(context): State<Context>,
  Json(input): Json<FinancialAccountInput>,
) -> Result<(StatusCode, Json<FinancialAccountResponse>), ApiError> {
  let draft = input.into_draft()?;
  let response = context.finance_service.create_financial_account(&draft).await?;
  Ok((StatusCode::CREATED, Json(response)))
}

pub(in crate::domains::finance) async fn update_financial_account(
  State(context): State<Context>,
  Path(id): Path<String>,
  Json(input): Json<FinancialAccountInput>,
) -> Result<Json<FinancialAccountResponse>, ApiError> {
  let draft = input.into_draft()?;
  let response = context.finance_service.update_financial_account(&id, &draft).await?;
  Ok(Json(response))
}

pub(in crate::domains::finance) async fn archive_financial_account(
  State(context): State<Context>,
  Path(id): Path<String>,
) -> Result<Json<FinancialAccountResponse>, ApiError> {
  let response = context.finance_service.archive_financial_account(&id).await?;
  Ok(Json(response))
}

pub(in crate::domains::finance) async fn list_transactions(
  State(context): State<Context>,
  Query(query): Query<TransactionsQueryInput>,
) -> Result<Json<TransactionListResponse>, ApiError> {
  let transactions_query = query.into_transactions_query()?;
  let response = context.finance_service.list_transactions(&transactions_query).await?;

  Ok(Json(response))
}

pub(in crate::domains::finance) async fn create_transaction(
  State(context): State<Context>,
  Json(input): Json<TransactionInput>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
  let draft = input.into_draft()?;
  let response = context.finance_service.create_transaction(&draft).await?;

  Ok((StatusCode::CREATED, Json(response)))
}

pub(in crate::domains::finance) async fn update_transaction(
  State(context): State<Context>,
  Path(id): Path<String>,
  Json(input): Json<TransactionInput>,
) -> Result<Json<TransactionResponse>, ApiError> {
  let draft = input.into_draft()?;
  let response = context.finance_service.update_transaction(&id, &draft).await?;

  Ok(Json(response))
}

pub(in crate::domains::finance) async fn delete_transaction(
  State(context): State<Context>,
  Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
  context.finance_service.delete_transaction(&id).await?;

  Ok(StatusCode::NO_CONTENT)
}
