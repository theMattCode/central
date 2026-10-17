use std::sync::Arc;

use crate::domains::finance::accounts::{
    FinancialAccount, FinancialAccountDraft, FinancialAccountListResponse, FinancialAccountStore,
};
use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
    TransactionDraft, TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::error::ApiError;

#[derive(Clone)]
pub struct FinanceService {
    store: Arc<dyn FinanceDataStore>,
    accounts: Arc<dyn FinancialAccountStore>,
}

impl FinanceService {
    pub fn new(store: Arc<dyn FinanceDataStore>, accounts: Arc<dyn FinancialAccountStore>) -> Self {
        Self { store, accounts }
    }

    pub async fn list_financial_accounts(&self) -> Result<FinancialAccountListResponse, ApiError> {
        let accounts = self.accounts.list_financial_accounts().await?;

        Ok(FinancialAccountListResponse { accounts })
    }

    pub async fn create_financial_account(
        &self,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        self.accounts.create_financial_account(draft).await
    }

    pub async fn update_financial_account(
        &self,
        id: &str,
        draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        self.accounts.update_financial_account(id, draft).await
    }

    pub async fn archive_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        self.accounts.archive_financial_account(id).await
    }

    pub async fn restore_financial_account(&self, id: &str) -> Result<FinancialAccount, ApiError> {
        self.accounts.restore_financial_account(id).await
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
