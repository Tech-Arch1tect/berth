FROM node:24-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY vite.config.ts tsconfig.json tsconfig.node.json tailwind.config.js postcss.config.js vite-env.d.ts ./
RUN npm run build

FROM golang:1.25-alpine AS go-builder

RUN apk add --no-cache zig

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
ARG TARGETARCH

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      CGO_ENABLED=1 GOOS=linux GOARCH=arm64 \
      CC="zig cc -target aarch64-linux-musl" \
      CXX="zig c++ -target aarch64-linux-musl" \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    else \
      CGO_ENABLED=1 GOOS=linux GOARCH=amd64 \
      CC="zig cc -target x86_64-linux-musl" \
      CXX="zig c++ -target x86_64-linux-musl" \
      go build -ldflags="-w -s -X berth/version.Version=${VERSION}" -o berth .; \
    fi

FROM alpine:3

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=go-builder /app/berth ./berth
COPY --from=frontend-builder /app/public/build ./public/build
COPY app.html ./app.html
COPY templates ./templates

EXPOSE 8080

CMD ["./berth"]
