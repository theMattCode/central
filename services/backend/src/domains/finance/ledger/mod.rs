#![allow(dead_code)]

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEntryKind {
  Income,
  Expense,
  ExpenseReversal,
  Transfer,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEntryStatus {
  Candidate,
  Confirmed,
  Dismissed,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEntryCandidateKind {
  Imported,
  Recurring,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEntrySourceType {
  Manual,
  Source,
  System,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEntrySourceKind {
  Imported,
  Recurring,
  Manual,
  System,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
  pub id: String,
  pub entry_kind: LedgerEntryKind,
  pub entry_status: LedgerEntryStatus,
  pub candidate_kind: Option<LedgerEntryCandidateKind>,
  pub financial_account_id: Option<String>,
  pub category_id: Option<String>,
  pub transfer_account_id: Option<String>,
  pub recurring_plan_id: Option<String>,
  pub source_id: Option<String>,
  pub transaction_date: NaiveDate,
  pub description: String,
  pub note: Option<String>,
  pub amount_minor_units: i64,
  pub currency_code: String,
  pub source_type: LedgerEntrySourceType,
  pub related_ledger_entry_id: Option<String>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntrySource {
  pub id: String,
  pub source_kind: LedgerEntrySourceKind,
  pub name: Option<String>,
  pub payload_json: Option<serde_json::Value>,
  pub payload_blob: Option<Vec<u8>>,
  pub created_at: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait LedgerRepository: Send + Sync {
  async fn list_ledger_entries(&self) -> Result<Vec<LedgerEntry>, ApiError>;
}
