use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

use crate::errors::AppError;

pub fn get_string(item: &HashMap<String, AttributeValue>, key: &str) -> Result<String, AppError> {
    item.get(key)
        .and_then(|v| v.as_s().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal(format!("Missing field: {key}")))
}

pub fn get_string_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<String> {
    item.get(key).and_then(|v| v.as_s().ok()).map(|s| s.to_string())
}

pub fn get_uuid(item: &HashMap<String, AttributeValue>, key: &str) -> Result<Uuid, AppError> {
    get_string(item, key)?
        .parse()
        .map_err(|e| AppError::Internal(format!("Invalid UUID for {key}: {e}")))
}

pub fn get_i64(item: &HashMap<String, AttributeValue>, key: &str) -> Result<i64, AppError> {
    item.get(key)
        .and_then(|v| v.as_n().ok())
        .and_then(|n| n.parse().ok())
        .ok_or_else(|| AppError::Internal(format!("Missing or invalid i64: {key}")))
}

pub fn get_i32_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<i32> {
    item.get(key)
        .and_then(|v| v.as_n().ok())
        .and_then(|n| n.parse().ok())
}

pub fn get_i64_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<i64> {
    item.get(key)
        .and_then(|v| v.as_n().ok())
        .and_then(|n| n.parse().ok())
}

pub fn get_bool(item: &HashMap<String, AttributeValue>, key: &str) -> bool {
    item.get(key)
        .and_then(|v| v.as_bool().ok())
        .copied()
        .unwrap_or(false)
}

pub fn get_datetime(item: &HashMap<String, AttributeValue>, key: &str) -> Result<DateTime<Utc>, AppError> {
    let s = get_string(item, key)?;
    s.parse::<DateTime<Utc>>()
        .map_err(|e| AppError::Internal(format!("Invalid datetime for {key}: {e}")))
}

pub fn get_string_list(item: &HashMap<String, AttributeValue>, key: &str) -> Vec<String> {
    item.get(key)
        .and_then(|v| v.as_l().ok())
        .map(|l| {
            l.iter()
                .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

pub fn get_json(item: &HashMap<String, AttributeValue>, key: &str) -> Result<serde_json::Value, AppError> {
    let s = get_string(item, key)?;
    serde_json::from_str(&s).map_err(|e| AppError::Internal(format!("Invalid JSON for {key}: {e}")))
}

pub fn get_json_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<serde_json::Value> {
    get_string_opt(item, key).and_then(|s| serde_json::from_str(&s).ok())
}

pub fn string_list_to_av(list: &[String]) -> AttributeValue {
    AttributeValue::L(list.iter().map(|s| AttributeValue::S(s.clone())).collect())
}
