FROM --platform=$BUILDPLATFORM node:24-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js vite-env.d.ts ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS go-builder

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
COPY --chown=65532:65532 app.html ./app.html
COPY --chown=65532:65532 templates ./templates

EXPOSE 8080
