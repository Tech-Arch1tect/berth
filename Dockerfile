FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js vite-env.d.ts ./
RUN npm run build

FROM golang:1.25-bookworm AS go-builder

RUN apt-get update && apt-get install -y \
    gcc-aarch64-linux-gnu \
    libc6-dev-arm64-cross \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
ARG TARGETARCH

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      CC=aarch64-linux-gnu-gcc CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    else \
      CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    fi

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=go-builder /app/berth ./berth
COPY --from=frontend-builder /app/public/build ./public/build
COPY app.html ./app.html
COPY templates ./templates

EXPOSE 8080

CMD ["./berth"]