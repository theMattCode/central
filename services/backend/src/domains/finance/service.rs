use std::sync::Arc;

use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{TransactionDraft, TransactionListResponse, TransactionResponse, TransactionsQuery};
use crate::error::ApiError;

#[derive(Clone)]
pub struct FinanceService {
  store: Arc<dyn FinanceDataStore>,
}

impl FinanceService {
  pub fn new(store: Arc<dyn FinanceDataStore>) -> Self {
    Self { store }
  }

  pub async fn list_transactions(
    &self,
    month: &TransactionsQuery,
  ) -> Result<TransactionListResponse, ApiError> {
    self.store.list_transactions(month).await
  }

  pub async fn create_transaction(
    &self,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    self.store.create_transaction(draft).await
  }

  pub async fn update_transaction(
    &self,
    id: &str,
    draft: &TransactionDraft,
  ) -> Result<TransactionResponse, ApiError> {
    self.store.update_transaction(id, draft).await
  }

  pub async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    self.store.delete_transaction(id).await
  }
}
