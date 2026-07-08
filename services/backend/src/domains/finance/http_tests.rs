use reqwest::StatusCode;

use crate::context::Context;
use crate::domains::finance::in_memory_finance_service;
use crate::test_support::{spawn_http_server, TestContextBuilder};

fn test_context() -> Context {
  TestContextBuilder::new("finance")
    .with_finance_service(in_memory_finance_service())
    .build()
}

#[tokio::test]
async fn create_update_archive_and_list_financial_accounts() {
  let base_url = spawn_http_server(test_context()).await;
  let client = reqwest::Client::new();

  let create_response = client
    .post(format!("{base_url}/api/v1/finance/accounts"))
    .json(&serde_json::json!({
      "name": "Wallet",
      "accountType": "cash",
      "primaryCurrencyCode": "eur",
      "displayOrder": 10
    }))
    .send()
    .await
    .expect("create financial account");

  assert_eq!(create_response.status(), StatusCode::CREATED);
  let created: serde_json::Value = create_response.json().await.expect("created account json");
  assert_eq!(created["name"], "Wallet");
  assert_eq!(created["accountType"], "cash");
  assert_eq!(created["primaryCurrencyCode"], "EUR");

  let account_id = created["id"].as_str().expect("account id");
  let update_response = client
    .put(format!("{base_url}/api/v1/finance/accounts/{account_id}"))
    .json(&serde_json::json!({
      "name": "Main Checking",
      "accountType": "bank",
      "primaryCurrencyCode": "EUR",
      "displayOrder": 1
    }))
    .send()
    .await
    .expect("update financial account");

  assert_eq!(update_response.status(), StatusCode::OK);
  let updated: serde_json::Value = update_response.json().await.expect("updated account json");
  assert_eq!(updated["name"], "Main Checking");
  assert_eq!(updated["accountType"], "bank");
  assert_eq!(updated["displayOrder"], 1);

  let archive_response = client
    .post(format!("{base_url}/api/v1/finance/accounts/{account_id}/archive"))
    .send()
    .await
    .expect("archive financial account");

  assert_eq!(archive_response.status(), StatusCode::OK);
  let archived: serde_json::Value = archive_response.json().await.expect("archived account json");
  assert_eq!(archived["status"], "archived");
  assert!(archived["archivedAt"].as_str().is_some());

  let list_response = client
    .get(format!("{base_url}/api/v1/finance/accounts"))
    .send()
    .await
    .expect("list financial accounts");

  assert_eq!(list_response.status(), StatusCode::OK);
  let payload: serde_json::Value = list_response.json().await.expect("list accounts json");
  assert_eq!(payload["accounts"].as_array().map(Vec::len), Some(1));
  assert_eq!(payload["accounts"][0]["status"], "archived");
}

#[tokio::test]
async fn invalid_financial_account_currency_returns_bad_request() {
  let base_url = spawn_http_server(test_context()).await;
  let client = reqwest::Client::new();

  let response = client
    .post(format!("{base_url}/api/v1/finance/accounts"))
    .json(&serde_json::json!({
      "name": "Wallet",
      "accountType": "cash",
      "primaryCurrencyCode": "EURO"
    }))
    .send()
    .await
    .expect("create invalid financial account");

  assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn create_and_list_transactions_returns_summary() {
  let base_url = spawn_http_server(test_context()).await;
  let client = reqwest::Client::new();

  let create_response = client
    .post(format!("{base_url}/api/v1/finance/transactions"))
    .json(&serde_json::json!({
        "direction": "income",
        "transactionDate": "2026-05-05",
        "amount": "123.45",
        "description": "Salary",
        "category": "Work"
    }))
    .send()
    .await
    .expect("create transaction");

  assert_eq!(create_response.status(), StatusCode::CREATED);

  let list_response = client
    .get(format!(
      "{base_url}/api/v1/finance/transactions?from=2026-05-01&to=2026-05-31"
    ))
    .send()
    .await
    .expect("list transactions");

  assert_eq!(list_response.status(), StatusCode::OK);
  let payload: serde_json::Value = list_response.json().await.expect("json payload");
  assert_eq!(payload["transactions"].as_array().map(Vec::len), Some(1));
  assert_eq!(payload["summary"]["incomeTotal"]["amount"], "123.45");
  assert_eq!(payload["summary"]["expenseTotal"]["amount"], "0.00");
  assert_eq!(payload["summary"]["netTotal"]["amount"], "123.45");
}

#[tokio::test]
async fn invalid_amount_returns_bad_request() {
  let base_url = spawn_http_server(test_context()).await;
  let client = reqwest::Client::new();

  let response = client
    .post(format!("{base_url}/api/v1/finance/transactions"))
    .json(&serde_json::json!({
        "direction": "expense",
        "transactionDate": "2026-05-05",
        "amount": "12.345",
        "description": "Groceries"
    }))
    .send()
    .await
    .expect("create transaction");

  assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn missing_delete_target_returns_not_found() {
  let base_url = spawn_http_server(test_context()).await;
  let client = reqwest::Client::new();

  let response = client
    .delete(format!(
      "{base_url}/api/v1/finance/transactions/00000000-0000-7000-8000-000000000404"
    ))
    .send()
    .await
    .expect("delete missing transaction");

  assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
