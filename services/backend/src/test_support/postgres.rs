use std::path::{Path, PathBuf};

use testcontainers_modules::postgres::Postgres;
use testcontainers_modules::testcontainers::{runners::AsyncRunner, ContainerAsync, ImageExt};
use tokio_postgres::NoTls;

/// Same base image as `i12e/postgres/Dockerfile`.
const POSTGRES_TAG: &str = "18.3-alpine";

/// A throwaway PostgreSQL with the `i12e/postgres` init scripts and migrations applied.
/// The container is removed when this value is dropped.
pub struct TestDatabase {
    _container: ContainerAsync<Postgres>,
    url: String,
}

impl TestDatabase {
    pub async fn start() -> Self {
        let container = Postgres::default()
            .with_tag(POSTGRES_TAG)
            .start()
            .await
            .expect("start PostgreSQL test container (is Docker running?)");
        let host = container.get_host().await.expect("test container host");
        let port = container
            .get_host_port_ipv4(5432)
            .await
            .expect("test container port");
        let url = format!("postgres://postgres:postgres@{host}:{port}/postgres");

        apply_sql_files(&url).await;

        Self {
            _container: container,
            url,
        }
    }

    pub fn url(&self) -> &str {
        &self.url
    }
}

async fn apply_sql_files(url: &str) {
    let (client, connection) = tokio_postgres::connect(url, NoTls)
        .await
        .expect("connect to PostgreSQL test container");
    tokio::spawn(connection);

    let postgres_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../i12e/postgres");
    let files = [
        sorted_sql_files(&postgres_dir.join("init")),
        sorted_sql_files(&postgres_dir.join("migrations")),
    ]
    .concat();

    for file in files {
        let sql = std::fs::read_to_string(&file)
            .unwrap_or_else(|error| panic!("read {}: {error}", file.display()));
        client
            .batch_execute(&sql)
            .await
            .unwrap_or_else(|error| panic!("apply {}: {error:?}", file.display()));
    }
}

/// Matches the glob order of `apply-migrations.sh`; migration numbers are zero-padded.
fn sorted_sql_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = std::fs::read_dir(dir)
        .unwrap_or_else(|error| panic!("read {}: {error}", dir.display()))
        .map(|entry| entry.expect("directory entry").path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "sql"))
        .collect::<Vec<_>>();
    files.sort();
    files
}
