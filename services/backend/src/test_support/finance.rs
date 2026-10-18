use std::sync::Arc;

use crate::domains::finance::accounts::{
    FinancialAccount, FinancialAccountDraft, FinancialAccountStore,
};
use crate::domains::finance::contracts::FinanceDataStore;
use crate::domains::finance::model::{
    TransactionDraft, TransactionListResponse, TransactionResponse, TransactionsQuery,
};
use crate::domains::finance::service::FinanceService;
use crate::error::ApiError;

/// A finance service for tests of other domains: every call fails, naming the test suite.
pub fn unused_finance_service(suite: &'static str) -> FinanceService {
    let store = Arc::new(UnusedFinanceStore { suite });
    FinanceService::new(store.clone(), store)
}

struct UnusedFinanceStore {
    suite: &'static str,
}

impl UnusedFinanceStore {
    fn unexpected_call(&self) -> ApiError {
        ApiError::Internal(format!(
            "finance store should not be called by {} tests",
            self.suite
        ))
    }
}

#[async_trait::async_trait]
impl FinanceDataStore for UnusedFinanceStore {
    async fn list_transactions(
        &self,
        _query: &TransactionsQuery,
    ) -> Result<TransactionListResponse, ApiError> {
        Err(self.unexpected_call())
    }

    async fn create_transaction(
        &self,
        _draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError> {
        Err(self.unexpected_call())
    }

    async fn update_transaction(
        &self,
        _id: &str,
        _draft: &TransactionDraft,
    ) -> Result<TransactionResponse, ApiError> {
        Err(self.unexpected_call())
    }

    async fn delete_transaction(&self, _id: &str) -> Result<(), ApiError> {
        Err(self.unexpected_call())
    }
}

#[async_trait::async_trait]
impl FinancialAccountStore for UnusedFinanceStore {
    async fn list_financial_accounts(&self) -> Result<Vec<FinancialAccount>, ApiError> {
        Err(self.unexpected_call())
    }

    async fn create_financial_account(
        &self,
        _draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        Err(self.unexpected_call())
    }

    async fn update_financial_account(
        &self,
        _id: &str,
        _draft: &FinancialAccountDraft,
    ) -> Result<FinancialAccount, ApiError> {
        Err(self.unexpected_call())
    }

    async fn archive_financial_account(&self, _id: &str) -> Result<FinancialAccount, ApiError> {
        Err(self.unexpected_call())
    }

    async fn restore_financial_account(&self, _id: &str) -> Result<FinancialAccount, ApiError> {
        Err(self.unexpected_call())
    }

    async fn reorder_financial_accounts(
        &self,
        _account_ids: &[String],
    ) -> Result<Vec<FinancialAccount>, ApiError> {
        Err(self.unexpected_call())
    }
}
