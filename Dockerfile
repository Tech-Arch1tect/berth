FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS api-spec

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go run ./cmd/openapi > openapi.json

FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --from=api-spec /app/openapi.json ./openapi.json
COPY orval.config.ts ./
COPY resources/js/api/client.ts ./resources/js/api/client.ts
RUN npm run api:generate-only

COPY resources ./resources
COPY utils ./utils
COPY public/pwa ./public/pwa
COPY vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js vite-env.d.ts ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS go-builder

RUN apk add --no-cache zig

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
ARG TARGETARCH

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
      CC="zig cc -target aarch64-linux-gnu" \
      CXX="zig c++ -target aarch64-linux-gnu" \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    else \
      CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
      CC="zig cc -target x86_64-linux-gnu" \
      CXX="zig c++ -target x86_64-linux-gnu" \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    fi

FROM docker.io/techarchitect/berth-base:latest

COPY --from=go-builder --chown=65532:65532 /app/berth ./berth
COPY --from=frontend-builder --chown=65532:65532 /app/public/build ./public/build
COPY --from=frontend-builder --chown=65532:65532 /app/public/pwa ./public/pwa
COPY --chown=65532:65532 app.html ./app.html
COPY --chown=65532:65532 templates ./templates

EXPOSE 8080
