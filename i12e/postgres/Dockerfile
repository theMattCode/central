FROM postgres:latest

LABEL org.opencontainers.image.title='central-i12e-postgres'
LABEL org.opencontainers.image.description='Persistence layer image for Central'

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1
