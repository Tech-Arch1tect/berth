dockerfile := "./dev/npm/Dockerfile"

image_tag := `sha256sum ./dev/npm/Dockerfile 2>/dev/null | cut -c1-12`
image := "dev-npm:" + image_tag

uid := `id -u`
gid := `id -g`

cache_prefix := "dev-npm"

_docker_run := """
docker run --rm -i $(test -t 0 && printf -- -t) \
  --user """ + uid + ":" + gid + """ \
  --volume $PWD:/app \
  --volume """ + cache_prefix + """-npm:/tmp/.npm \
  --volume """ + cache_prefix + """-playwright:/tmp/.cache/ms-playwright \
  --volume """ + cache_prefix + """-go-mod:/tmp/go-mod \
  --volume """ + cache_prefix + """-go-build:/tmp/go-build \
  --workdir /app \
  --read-only \
  --tmpfs /tmp:exec \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  -e HOME=/tmp \
  -e npm_config_cache=/tmp/.npm \
  -e PLAYWRIGHT_BROWSERS_PATH=/tmp/.cache/ms-playwright \
  """ + image

default:
    @just --list

_build:
    @docker image inspect {{image}} >/dev/null 2>&1 || \
        docker build -t {{image}} -f {{dockerfile}} ./dev/npm

_prep-caches: _build
    @for vol in npm playwright go-mod go-build; do \
        full="{{cache_prefix}}-$vol"; \
        docker volume inspect "$full" >/dev/null 2>&1 || { \
            docker volume create "$full" >/dev/null; \
            docker run --rm --user 0:0 --volume "$full:/v" {{image}} \
                chown {{uid}}:{{gid}} /v; \
        }; \
    done

rebuild:
    docker build --no-cache --pull -t {{image}} -f {{dockerfile}} ./dev/npm

npm *args: _prep-caches
    {{_docker_run}} npm {{args}}

npx *args: _prep-caches
    {{_docker_run}} npx {{args}}

go *args: _prep-caches
    {{_docker_run}} go {{args}}

test-server *args: _prep-caches
    {{_docker_run}} go test {{args}} ./...

test-unit *args: _prep-caches
    {{_docker_run}} npm run test:unit -- {{args}}

test-e2e *args: _prep-caches
    {{_docker_run}} npm run test:e2e -- {{args}}

install-browsers: _prep-caches
    {{_docker_run}} npx playwright install chromium

vet: _prep-caches
    {{_docker_run}} go vet ./...

type-check: _prep-caches
    {{_docker_run}} npm run type-check

lint: _prep-caches
    {{_docker_run}} npm run lint

test: vet type-check lint test-unit test-server test-e2e

format: _prep-caches
    {{_docker_run}} npm run format
    {{_docker_run}} go fmt ./...

npm-shell: _prep-caches
    {{_docker_run}} bash

clean-cache:
    -docker volume rm \
        {{cache_prefix}}-npm \
        {{cache_prefix}}-playwright \
        {{cache_prefix}}-go-mod \
        {{cache_prefix}}-go-build

clean:
    @docker images --format '{{{{.Repository}}:{{{{.Tag}}' dev-npm \
        | grep -v '^{{image}}$' \
        | xargs -r docker rmi
