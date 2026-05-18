FROM postgres:18.3-alpine

LABEL org.opencontainers.image.title='central-i12e-postgres'
LABEL org.opencontainers.image.description='Persistence layer image for Central'

COPY init/ /docker-entrypoint-initdb.d/
COPY migrations/ /opt/central/migrations/
COPY scripts/apply-migrations.sh /usr/local/bin/apply-migrations.sh

RUN chmod +x /usr/local/bin/apply-migrations.sh

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
