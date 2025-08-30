FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG TARGETARCH

COPY ./bin/berth-${TARGETARCH} ./berth
COPY ./public/build ./public/build
COPY ./app.html ./app.html
COPY ./templates ./templates

EXPOSE 8080

CMD ["./berth"]