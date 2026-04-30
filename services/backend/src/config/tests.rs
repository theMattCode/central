use super::DEFAULT_DATABASE_URL;

#[test]
fn default_database_url_points_to_local_dev_port() {
    assert_eq!(
        DEFAULT_DATABASE_URL,
        "postgres://central:central@localhost:3001/central"
    );
}
