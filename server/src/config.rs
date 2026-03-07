use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub dynamodb_table: String,
    pub flat_manager_token: String,
    pub flat_manager_webhook_secret: String,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_org: String,
    pub github_token: String,
    pub jwt_secret: String,
    pub frontend_url: String,
    pub ecs_cluster: String,
    pub ecs_service: String,
    pub repo_s3_bucket: String,
    pub repo_cdn_url: String,
    pub repo_gpg_key: String,
    pub cf_logs_bucket: String,
    pub cf_logs_prefix: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".into())
                .parse()
                .expect("PORT must be a number"),
            dynamodb_table: env::var("DYNAMODB_TABLE")
                .unwrap_or_else(|_| "friendlyhub-dev".into()),
            flat_manager_token: env::var("FLAT_MANAGER_TOKEN")
                .unwrap_or_else(|_| "dev-token".into()),
            flat_manager_webhook_secret: env::var("FLAT_MANAGER_WEBHOOK_SECRET")
                .unwrap_or_else(|_| "dev-webhook-secret".into()),
            github_client_id: env::var("GITHUB_CLIENT_ID")
                .unwrap_or_else(|_| "dev-client-id".into()),
            github_client_secret: env::var("GITHUB_CLIENT_SECRET")
                .unwrap_or_else(|_| "dev-client-secret".into()),
            github_org: env::var("GITHUB_ORG").unwrap_or_else(|_| "friendlyhub".into()),
            github_token: env::var("GITHUB_TOKEN").unwrap_or_default(),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-me".into()),
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
            ecs_cluster: env::var("ECS_CLUSTER")
                .unwrap_or_else(|_| "friendlyhub-dev".into()),
            ecs_service: env::var("ECS_SERVICE")
                .unwrap_or_else(|_| "flat-manager".into()),
            repo_s3_bucket: env::var("REPO_S3_BUCKET")
                .unwrap_or_else(|_| "friendlyhub-dev-ostreerepobucket-3tirz1kgdfla".into()),
            repo_cdn_url: env::var("REPO_CDN_URL")
                .unwrap_or_else(|_| "https://dl.friendlyhub.org".into()),
            repo_gpg_key: env::var("REPO_GPG_KEY").unwrap_or_default(),
            cf_logs_bucket: env::var("CF_LOGS_BUCKET").unwrap_or_default(),
            cf_logs_prefix: env::var("CF_LOGS_PREFIX").unwrap_or_else(|_| "cdn/".into()),
        }
    }

    pub fn listen_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
