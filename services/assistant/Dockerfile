FROM rust:1.89-alpine AS base
RUN apk add --no-cache build-base musl-dev
WORKDIR /workspace/services

FROM base AS dev
RUN cargo install cargo-watch --locked
# Cargo needs every workspace member to resolve the workspace.
COPY services/Cargo.toml services/Cargo.lock ./
COPY services/assistant/Cargo.toml ./assistant/Cargo.toml
COPY services/assistant/src ./assistant/src
COPY services/backend/Cargo.toml ./backend/Cargo.toml
COPY services/backend/src ./backend/src
WORKDIR /workspace/services/assistant
ENV ASSISTANT_PORT=8080
ENV ASSISTANT_BACKEND_MODE=mock
EXPOSE 8080
CMD ["cargo", "watch", "--why", "--watch", "Cargo.toml", "--watch", "src", "-x", "run"]

FROM base AS builder
# Cargo needs every workspace member to resolve the workspace.
COPY services/Cargo.toml services/Cargo.lock ./
COPY services/assistant/Cargo.toml ./assistant/Cargo.toml
COPY services/assistant/src ./assistant/src
COPY services/backend/Cargo.toml ./backend/Cargo.toml
COPY services/backend/src ./backend/src
RUN cargo build --release --package assistant-service

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
RUN adduser -D assistant
COPY --from=builder /workspace/services/target/release/assistant-service /usr/local/bin/assistant-service
ENV ASSISTANT_PORT=8080
ENV ASSISTANT_BACKEND_MODE=mock
EXPOSE 8080
USER assistant
CMD ["/usr/local/bin/assistant-service"]
