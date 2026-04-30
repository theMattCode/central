FROM rust:1.89-alpine AS builder

WORKDIR /workspace/services/backend

RUN apk add --no-cache build-base musl-dev

COPY services/backend/Cargo.toml ./Cargo.toml
COPY services/backend/src ./src

RUN cargo build --release

FROM alpine:3.22

RUN apk add --no-cache ca-certificates
RUN adduser -D backend

COPY --from=builder /workspace/services/backend/target/release/backend /usr/local/bin/backend

ENV BACKEND_PORT=8080

EXPOSE 8080

USER backend

CMD ["/usr/local/bin/backend"]
