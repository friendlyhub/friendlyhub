use aws_sdk_dynamodb::Client;

/// DynamoDB table name wrapper. All entities share one table.
#[derive(Clone, Debug)]
pub struct Db {
    pub client: Client,
    pub table: String,
}

impl Db {
    pub fn new(client: Client, table: String) -> Self {
        Self { client, table }
    }
}
