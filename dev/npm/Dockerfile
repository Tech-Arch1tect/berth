FROM node:24.15.0-trixie-slim

ARG GO_VERSION=1.26.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        curl \
        build-essential \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcursor1 \
        libgtk-3-0 \
        libgdk-pixbuf-2.0-0 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libcairo2 \
        libcairo-gobject2 \
        fonts-liberation \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN ARCH="$(dpkg --print-architecture)" \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${ARCH}.tar.gz" \
        -o /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

ENV PATH=/usr/local/go/bin:$PATH \
    GOPATH=/tmp/go \
    GOCACHE=/tmp/go-build \
    GOMODCACHE=/tmp/go-mod

WORKDIR /app
