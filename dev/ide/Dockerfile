FROM codercom/code-server:latest

USER root

ARG GO_VERSION=1.26.3
RUN curl -fsSL https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz \
    | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:/home/coder/go/bin:${PATH}"
ENV GOPATH="/home/coder/go"

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

USER coder

RUN go install golang.org/x/tools/gopls@latest \
    && go install github.com/go-delve/delve/cmd/dlv@latest

RUN sudo npm install -g typescript typescript-language-server prettier

RUN code-server --install-extension golang.go \
    && code-server --install-extension esbenp.prettier-vscode

RUN mkdir -p /home/coder/.local/share/code-server/User
COPY --chown=coder:coder settings.json /home/coder/.local/share/code-server/User/settings.json
