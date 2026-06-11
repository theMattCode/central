FROM rust:1.89-alpine AS base
RUN apk add --no-cache build-base musl-dev
WORKDIR /workspace/services/backend

FROM base AS dev
RUN cargo install cargo-watch --locked
COPY services/backend/Cargo.toml ./Cargo.toml
COPY services/backend/src ./src
ENV BACKEND_PORT=8080
EXPOSE 8080
CMD ["cargo", "watch", "--why", "--watch", "Cargo.toml", "--watch", "src", "-x", "run"]

FROM base AS builder

COPY services/backend/Cargo.toml ./Cargo.toml
COPY services/backend/src ./src

RUN cargo build --release

FROM alpine:3.22

RUN apk add --no-cache ca-certificates wget
RUN adduser -D backend

COPY --from=builder /workspace/services/backend/target/release/central-backend /usr/local/bin/central-backend

ENV BACKEND_PORT=8080

EXPOSE 8080

USER backend

CMD ["/usr/local/bin/central-backend"]
