use std::collections::HashMap;
use std::io::Read;

use flate2::read::GzDecoder;

use crate::db::Db;
use crate::errors::AppError;
use crate::models::app;

/// Process CloudFront access logs from S3, count install requests per app,
/// and update DynamoDB. Deletes processed log files afterward.
pub async fn process_logs(
    s3_client: &aws_sdk_s3::Client,
    db: &Db,
    logs_bucket: &str,
    logs_prefix: &str,
) -> Result<ProcessResult, AppError> {
    // List log files
    let list = s3_client
        .list_objects_v2()
        .bucket(logs_bucket)
        .prefix(logs_prefix)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to list CF logs: {e}")))?;

    let objects = match list.contents() {
        [] => return Ok(ProcessResult { files_processed: 0, installs: HashMap::new() }),
        contents => contents,
    };

    let mut counts: HashMap<String, i64> = HashMap::new();
    let mut files_processed = 0;
    let mut keys_to_delete = Vec::new();

    for obj in objects {
        let key = match obj.key() {
            Some(k) => k,
            None => continue,
        };

        // CF logs are .gz files
        if !key.ends_with(".gz") {
            continue;
        }

        let resp = s3_client
            .get_object()
            .bucket(logs_bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to get log file {key}: {e}")))?;

        let body = resp.body.collect().await
            .map_err(|e| AppError::Internal(format!("Failed to read log file {key}: {e}")))?;

        let bytes = body.into_bytes();
        let mut decoder = GzDecoder::new(bytes.as_ref());
        let mut text = String::new();
        if decoder.read_to_string(&mut text).is_err() {
            tracing::warn!("Failed to decompress log file {key}, skipping");
            continue;
        }

        for line in text.lines() {
            // Skip comment lines
            if line.starts_with('#') {
                continue;
            }

            // CF log fields are tab-separated (standard logs) or space-separated
            // Standard log format: date time x-edge-location sc-bytes c-ip cs-method
            //   cs(Host) cs-uri-stem sc-status ...
            // Field 7 (0-indexed) is cs-uri-stem (the path)
            let fields: Vec<&str> = line.split('\t').collect();
            let path = if fields.len() > 7 {
                fields[7]
            } else {
                // Try space-separated (older format)
                let space_fields: Vec<&str> = line.split_whitespace().collect();
                if space_fields.len() > 7 {
                    space_fields[7]
                } else {
                    continue;
                }
            };

            // Match /repo/refs/heads/app/{app_id}/{arch}/{branch}
            // e.g. /repo/refs/heads/app/com.example.App/x86_64/stable
            if let Some(app_id) = extract_app_id_from_ref_path(path) {
                *counts.entry(app_id).or_insert(0) += 1;
            }
        }

        keys_to_delete.push(key.to_string());
        files_processed += 1;
    }

    // Update DynamoDB with the counts
    for (app_id, count) in &counts {
        if let Ok(Some(a)) = app::find_by_app_id(db, app_id).await {
            if let Err(e) = app::increment_install_count(db, a.id, *count).await {
                tracing::warn!(app_id, error = %e, "Failed to update install count");
            }
        }
    }

    // Delete processed log files
    for key in &keys_to_delete {
        if let Err(e) = s3_client
            .delete_object()
            .bucket(logs_bucket)
            .key(key)
            .send()
            .await
        {
            tracing::warn!(key, error = %e, "Failed to delete processed log file");
        }
    }

    Ok(ProcessResult {
        files_processed,
        installs: counts,
    })
}

/// Extract app ID from a CloudFront log URI path like
/// `/repo/refs/heads/app/com.example.App/x86_64/stable`
fn extract_app_id_from_ref_path(path: &str) -> Option<String> {
    let path = path.strip_prefix('/').unwrap_or(path);
    let parts: Vec<&str> = path.split('/').collect();
    // Expected: repo / refs / heads / app / {app_id} / {arch} / {branch}
    if parts.len() >= 7
        && parts[0] == "repo"
        && parts[1] == "refs"
        && parts[2] == "heads"
        && parts[3] == "app"
    {
        Some(parts[4].to_string())
    } else {
        None
    }
}

pub struct ProcessResult {
    pub files_processed: usize,
    pub installs: HashMap<String, i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_app_id() {
        assert_eq!(
            extract_app_id_from_ref_path("/repo/refs/heads/app/com.example.App/x86_64/stable"),
            Some("com.example.App".to_string())
        );
        assert_eq!(
            extract_app_id_from_ref_path("repo/refs/heads/app/org.test.Foo/x86_64/stable"),
            Some("org.test.Foo".to_string())
        );
        assert_eq!(
            extract_app_id_from_ref_path("/repo/objects/ab/cdef.commit"),
            None
        );
        assert_eq!(
            extract_app_id_from_ref_path("/repo/summary"),
            None
        );
    }
}
