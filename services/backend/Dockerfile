FROM rust:1.89-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/services/backend

FROM base AS dev
RUN cargo install cargo-watch --locked
COPY services/backend/Cargo.toml ./Cargo.toml
COPY services/backend/Cargo.lock ./Cargo.lock
COPY services/backend/src ./src
ENV BACKEND_PORT=8080
EXPOSE 8080
CMD ["cargo", "watch", "--why", "--watch", "Cargo.toml", "--watch", "src", "-x", "run"]

FROM base AS builder

COPY services/backend/Cargo.toml ./Cargo.toml
COPY services/backend/Cargo.lock ./Cargo.lock
COPY services/backend/src ./src

RUN cargo build --release

FROM busybox:1.37.0-glibc

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/lib/x86_64-linux-gnu/libgcc_s.so.1 /usr/lib/libgcc_s.so.1

COPY --from=builder /workspace/services/backend/target/release/central-backend /usr/local/bin/central-backend

ENV BACKEND_PORT=8080

EXPOSE 8080

USER 65532:65532

CMD ["/usr/local/bin/central-backend"]
