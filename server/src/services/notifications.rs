use uuid::Uuid;

/// Notification stubs — placeholder for future email/webhook/push notifications.
/// For now, these just log. Swap in real implementations later (SES, SNS, etc.).

pub async fn notify_build_complete(submission_id: Uuid, success: bool) {
    if success {
        tracing::info!(submission_id = %submission_id, "NOTIFY: Build succeeded, submission moved to review queue");
    } else {
        tracing::info!(submission_id = %submission_id, "NOTIFY: Build failed");
    }
}

pub async fn notify_review_decision(submission_id: Uuid, decision: &str, comment: &str) {
    tracing::info!(
        submission_id = %submission_id,
        decision = decision,
        comment = comment,
        "NOTIFY: Review decision recorded"
    );
}

pub async fn notify_published(submission_id: Uuid, app_id: &str) {
    tracing::info!(
        submission_id = %submission_id,
        app_id = app_id,
        "NOTIFY: App published to repository"
    );
}
