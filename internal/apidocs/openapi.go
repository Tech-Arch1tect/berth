package apidocs

import (
	"github.com/tech-arch1tect/brx/openapi"
)

func NewOpenAPI() *openapi.OpenAPI {
	return openapi.New("Berth API", "1.0.0").
		Description("Berth: Opinionated docker compose stack management API").
		License("GPL-2.0", "https://www.gnu.org/licenses/old-licenses/gpl-2.0.html").
		BearerAuth("bearerAuth", "JWT token").
		BearerAuth("apiKey", "API key").
		CookieAuth("session", "session_id", "Browser session cookie").
		Tag("auth", "Authentication endpoints").
		Tag("servers", "Server management").
		Tag("stacks", "Docker stacks").
		Tag("operations", "Operation execution").
		Tag("files", "Stack file management").
		Tag("logs", "Container and operation logs").
		Tag("admin", "Administrative operations")
}
