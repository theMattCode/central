FROM rust:1.89-alpine AS builder

WORKDIR /workspace/services/weather

RUN apk add --no-cache build-base musl-dev

COPY services/weather/Cargo.toml ./Cargo.toml
COPY services/weather/src ./src

RUN cargo build --release

FROM alpine:3.22

RUN apk add --no-cache ca-certificates
RUN adduser -D weather

COPY --from=builder /workspace/services/weather/target/release/weather-service /usr/local/bin/weather-service

ENV WEATHER_PORT=8080
ENV WEATHER_RUNTIME_MODE=both

EXPOSE 8080

USER weather

CMD ["/usr/local/bin/weather-service"]
