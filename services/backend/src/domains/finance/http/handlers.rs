use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};

use crate::{
    context::Context,
    domains::finance::domain::model::{
        MonthQueryInput, TransactionInput, TransactionListResponse, TransactionResponse,
    },
    error::ApiError,
};

pub(super) async fn list_transactions(
    State(context): State<Context>,
    Query(query): Query<MonthQueryInput>,
) -> Result<Json<TransactionListResponse>, ApiError> {
    let month = query.into_month_query()?;
    let response = context.finance_service.list_transactions(&month).await?;

    Ok(Json(response))
}

pub(super) async fn create_transaction(
    State(context): State<Context>,
    Json(input): Json<TransactionInput>,
) -> Result<(StatusCode, Json<TransactionResponse>), ApiError> {
    let draft = input.into_draft()?;
    let response = context.finance_service.create_transaction(&draft).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub(super) async fn update_transaction(
    State(context): State<Context>,
    Path(id): Path<String>,
    Json(input): Json<TransactionInput>,
) -> Result<Json<TransactionResponse>, ApiError> {
    let draft = input.into_draft()?;
    let response = context
        .finance_service
        .update_transaction(&id, &draft)
        .await?;

    Ok(Json(response))
}

pub(super) async fn delete_transaction(
    State(context): State<Context>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    context.finance_service.delete_transaction(&id).await?;

    Ok(StatusCode::NO_CONTENT)
}
