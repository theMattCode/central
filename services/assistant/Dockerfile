FROM rust:1.89-alpine AS builder
WORKDIR /workspace/services/assistant
RUN apk add --no-cache build-base musl-dev
COPY services/assistant/Cargo.toml ./Cargo.toml
COPY services/assistant/src ./src
RUN cargo build --release

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
RUN adduser -D assistant
COPY --from=builder /workspace/services/assistant/target/release/assistant-service /usr/local/bin/assistant-service
ENV ASSISTANT_PORT=8080
ENV ASSISTANT_BACKEND_MODE=mock
EXPOSE 8080
USER assistant
CMD ["/usr/local/bin/assistant-service"]
