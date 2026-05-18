use crate::{
    domains::finance::domain::model::{
        MonthQuery, TransactionDraft, TransactionListResponse, TransactionResponse,
    },
    error::ApiError,
};

#[async_trait::async_trait]
pub trait FinanceDataStore: Send + Sync {
    async fn list_transactions(
        &self,
        month: &MonthQuery,
    ) -> Result<TransactionListResponse, ApiError>;

    async fn create_transaction(
        &self,
        draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError>;

    async fn update_transaction(
        &self,
        id: &str,
        draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError>;

    async fn delete_transaction(&self, id: &str) -> Result<(), ApiError>;
}
