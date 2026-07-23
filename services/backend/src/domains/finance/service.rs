use std::sync::Arc;

use crate::domains::finance::model::{
  FinancialAccountCreateDraft, FinancialAccountListResponse, FinancialAccountResponse, FinancialAccountUpdateDraft,
  TransactionDraft, TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::domains::finance::repository::FinanceRepository;
use crate::error::ApiError;

#[derive(Clone)]
pub struct FinanceService {
  repository: Arc<FinanceRepository>,
}

impl FinanceService {
  pub fn new(repository: Arc<FinanceRepository>) -> Self {
    Self { repository }
  }

  pub async fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
    self.repository.list_financial_accounts().await
  }

  pub async fn create_financial_account(
    &self,
    draft: &FinancialAccountCreateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    self.repository.create_financial_account(draft).await
  }

  pub async fn update_financial_account(
    &self,
    id: &str,
    draft: &FinancialAccountUpdateDraft,
  ) -> Result<FinancialAccountResponse, ApiError> {
    self.repository.update_financial_account(id, draft).await
  }

  pub async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccountResponse, ApiError> {
    self.repository.archive_financial_account(id).await
  }

  pub async fn list_transactions(&self, month: &TransactionsQuery) -> Result<TransactionListResponse, ApiError> {
    self.repository.list_transactions(month).await
  }

  pub async fn create_transaction(&self, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    self.repository.create_transaction(draft).await
  }

  pub async fn update_transaction(&self, id: &str, draft: &TransactionDraft) -> Result<TransactionResponse, ApiError> {
    self.repository.update_transaction(id, draft).await
  }

  pub async fn delete_transaction(&self, id: &str) -> Result<(), ApiError> {
    self.repository.delete_transaction(id).await
  }
}
