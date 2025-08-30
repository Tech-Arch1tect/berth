FROM alpine:3.20

RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /app

ARG TARGETARCH

COPY ./bin/berth-${TARGETARCH} ./berth
COPY ./public/build ./public/build
COPY ./app.html ./app.html
COPY ./templates ./templates

EXPOSE 8080

CMD ["./berth"]