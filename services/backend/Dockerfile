FROM rust:1.99-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/services

FROM base AS dev
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget \
    && rm -rf /var/lib/apt/lists/*
RUN cargo install cargo-watch --locked
# Cargo needs every workspace member to resolve the workspace.
COPY services/Cargo.toml services/Cargo.lock ./
COPY services/assistant/Cargo.toml ./assistant/Cargo.toml
COPY services/assistant/src ./assistant/src
COPY services/backend/Cargo.toml ./backend/Cargo.toml
COPY services/backend/src ./backend/src
COPY services/observability/Cargo.toml ./observability/Cargo.toml
COPY services/observability/src ./observability/src
WORKDIR /workspace/services/backend
ENV BACKEND_PORT=8080
EXPOSE 8080
CMD ["cargo", "watch", "--why", "--watch", "Cargo.toml", "--watch", "src", "-x", "run"]

FROM base AS builder

# Cargo needs every workspace member to resolve the workspace.
COPY services/Cargo.toml services/Cargo.lock ./
COPY services/assistant/Cargo.toml ./assistant/Cargo.toml
COPY services/assistant/src ./assistant/src
COPY services/backend/Cargo.toml ./backend/Cargo.toml
COPY services/backend/src ./backend/src
COPY services/observability/Cargo.toml ./observability/Cargo.toml
COPY services/observability/src ./observability/src

RUN cargo build --release --package central-backend

FROM busybox:1.37.0-glibc

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/lib/x86_64-linux-gnu/libgcc_s.so.1 /usr/lib/libgcc_s.so.1

COPY --from=builder /workspace/services/target/release/central-backend /usr/local/bin/central-backend

ARG SENTRY_RELEASE=
ENV BACKEND_PORT=8080
ENV SENTRY_RELEASE=$SENTRY_RELEASE

EXPOSE 8080

USER 65532:65532

CMD ["/usr/local/bin/central-backend"]
