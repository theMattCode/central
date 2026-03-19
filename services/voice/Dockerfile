FROM rust:1.89-alpine AS builder
WORKDIR /workspace/services/voice
RUN apk add --no-cache build-base musl-dev
COPY services/voice/Cargo.toml ./Cargo.toml
COPY services/voice/src ./src
RUN cargo build --release

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
RUN adduser -D voice
COPY --from=builder /workspace/services/voice/target/release/voice-service /usr/local/bin/voice-service
ENV VOICE_PORT=8080
ENV VOICE_BACKEND_MODE=mock
EXPOSE 8080
USER voice
CMD ["/usr/local/bin/voice-service"]
