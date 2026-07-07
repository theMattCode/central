#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CategoryStatus {
  Active,
  Archived,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Category {
  pub id: String,
  pub parent_category_id: Option<String>,
  pub name: String,
  pub status: CategoryStatus,
  pub archived_at: Option<DateTime<Utc>>,
  pub created_at: DateTime<Utc>,
  pub updated_at: DateTime<Utc>,
}

#[async_trait::async_trait]
pub trait CategoryRepository: Send + Sync {
  async fn list_categories(&self) -> Result<Vec<Category>, ApiError>;
}
