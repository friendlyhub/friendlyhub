use crate::services::github::GitHubService;

pub async fn notify_build_complete(
    github: &GitHubService,
    app_id: &str,
    version: &str,
    success: bool,
    build_log_url: Option<&str>,
) {
    let (title, body, label) = if success {
        (
            format!("v{version} build succeeded"),
            format!(
                "**{app_id}** v{version} built successfully and is now in the review queue.\n\n\
                 You will be notified here when a reviewer has looked at it."
            ),
            "build-succeeded",
        )
    } else {
        let log_line = match build_log_url {
            Some(url) => format!("\n\n[View build log]({url})"),
            None => String::new(),
        };
        (
            format!("v{version} build failed"),
            format!(
                "**{app_id}** v{version} failed to build.{log_line}\n\n\
                 Please fix the issue and submit a new version."
            ),
            "build-failed",
        )
    };

    if let Err(e) = github
        .create_issue(app_id, &title, &body, &[label])
        .await
    {
        tracing::warn!(
            app_id = app_id,
            error = %e,
            "Failed to create GitHub issue for build notification"
        );
    }
}

pub async fn notify_review_decision(
    github: &GitHubService,
    app_id: &str,
    version: &str,
    decision: &str,
    comment: &str,
) {
    if decision != "changes_requested" || comment.is_empty() {
        return;
    }

    let title = format!("Changes requested for v{version}");
    let body = format!(
        "A reviewer has requested changes for **{app_id}** v{version}:\n\n\
         > {}\n\n\
         Please address the feedback and submit a new version via PR to this repo.",
        comment.replace('\n', "\n> ")
    );

    if let Err(e) = github
        .create_issue(app_id, &title, &body, &["changes-requested"])
        .await
    {
        tracing::warn!(
            app_id = app_id,
            error = %e,
            "Failed to create GitHub issue for review feedback"
        );
    }
}

pub async fn notify_published(
    github: &GitHubService,
    app_id: &str,
    version: &str,
) {
    let title = format!("v{version} published");
    let body = format!(
        "**{app_id}** v{version} has been approved and published to the FriendlyHub repository.\n\n\
         Users can now install it via:\n\
         ```\n\
         flatpak install friendlyhub {app_id}\n\
         ```"
    );

    if let Err(e) = github
        .create_issue(app_id, &title, &body, &["published"])
        .await
    {
        tracing::warn!(
            app_id = app_id,
            error = %e,
            "Failed to create GitHub issue for publish notification"
        );
    }
}
