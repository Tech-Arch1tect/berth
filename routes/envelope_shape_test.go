package routes

import (
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"berth/internal/pkg/apidocs"
)

var envelopeExempt = map[string]bool{
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/files/download": true,
	"POST /api/v1/admin/migration/export":                              true,
}

var legacyEnvelopeAllowlist = map[string]bool{
	"POST /api/v1/auth/login":                 true,
	"POST /api/v1/auth/refresh":               true,
	"POST /api/v1/auth/totp/verify":           true,
	"POST /api/v1/auth/logout":                true,
	"POST /api/v1/sessions":                   true,
	"POST /api/v1/sessions/revoke":            true,
	"POST /api/v1/sessions/revoke-all-others": true,
	"GET /api/v1/profile":                     true,
	"GET /api/v1/totp/setup":                  true,
	"GET /api/v1/totp/status":                 true,
	"POST /api/v1/totp/enable":                true,
	"POST /api/v1/totp/disable":               true,

	"GET /api/v1/version": true,

	"GET /api/v1/api-keys":                          true,
	"GET /api/v1/api-keys/{id}":                     true,
	"POST /api/v1/api-keys":                         true,
	"DELETE /api/v1/api-keys/{id}":                  true,
	"GET /api/v1/api-keys/{id}/scopes":              true,
	"POST /api/v1/api-keys/{id}/scopes":             true,
	"DELETE /api/v1/api-keys/{id}/scopes/{scopeId}": true,

	"GET /api/v1/servers/{serverid}/registries":         true,
	"GET /api/v1/servers/{serverid}/registries/{id}":    true,
	"POST /api/v1/servers/{serverid}/registries":        true,
	"PUT /api/v1/servers/{serverid}/registries/{id}":    true,
	"DELETE /api/v1/servers/{serverid}/registries/{id}": true,

	"GET /api/v1/servers":                       true,
	"GET /api/v1/servers/{serverid}/statistics": true,
	"GET /api/v1/admin/servers":                 true,
	"POST /api/v1/admin/servers":                true,
	"PUT /api/v1/admin/servers/{id}":            true,
	"DELETE /api/v1/admin/servers/{id}":         true,
	"POST /api/v1/admin/servers/{id}/test":      true,

	"GET /api/v1/admin/security-audit-logs":       true,
	"GET /api/v1/admin/security-audit-logs/stats": true,
	"GET /api/v1/admin/security-audit-logs/{id}":  true,

	"GET /api/v1/servers/{serverid}/stacks/{stackname}/logs":                            true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/containers/{containerName}/logs": true,

	"GET /api/v1/operation-logs":                               true,
	"GET /api/v1/operation-logs/stats":                         true,
	"GET /api/v1/operation-logs/{id}":                          true,
	"GET /api/v1/operation-logs/by-operation-id/{operationId}": true,
	"GET /api/v1/running-operations":                           true,
	"GET /api/v1/admin/operation-logs":                         true,
	"GET /api/v1/admin/operation-logs/stats":                   true,
	"GET /api/v1/admin/operation-logs/{id}":                    true,

	"GET /api/v1/admin/users":                                              true,
	"POST /api/v1/admin/users":                                             true,
	"GET /api/v1/admin/users/{id}/roles":                                   true,
	"POST /api/v1/admin/users/assign-role":                                 true,
	"POST /api/v1/admin/users/revoke-role":                                 true,
	"GET /api/v1/admin/roles":                                              true,
	"POST /api/v1/admin/roles":                                             true,
	"PUT /api/v1/admin/roles/{id}":                                         true,
	"DELETE /api/v1/admin/roles/{id}":                                      true,
	"GET /api/v1/admin/roles/{roleId}/stack-permissions":                   true,
	"POST /api/v1/admin/roles/{roleId}/stack-permissions":                  true,
	"DELETE /api/v1/admin/roles/{roleId}/stack-permissions/{permissionId}": true,
	"GET /api/v1/admin/permissions":                                        true,

	"GET /api/v1/servers/{serverid}/maintenance/permissions": true,
	"GET /api/v1/servers/{serverid}/maintenance/info":        true,
	"POST /api/v1/servers/{serverid}/maintenance/prune":      true,
	"DELETE /api/v1/servers/{serverid}/maintenance/resource": true,

	"GET /api/v1/image-updates":                    true,
	"GET /api/v1/servers/{serverid}/image-updates": true,

	"POST /api/v1/servers/{serverid}/stacks/{stackname}/vulnscan":        true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/vulnscan":         true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/vulnscan/history": true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/vulnscan/trend":   true,
	"GET /api/v1/vulnscan/{scanid}":                                      true,
	"GET /api/v1/vulnscan/{scanid}/summary":                              true,
	"GET /api/v1/vulnscan/compare/{baseScanId}/{compareScanId}":          true,

	"GET /api/v1/servers/{serverid}/stacks/{stackname}/files":           true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/files/read":      true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/write":    true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/upload":   true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/mkdir":    true,
	"DELETE /api/v1/servers/{serverid}/stacks/{stackname}/files/delete": true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/rename":   true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/copy":     true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/chmod":    true,
	"POST /api/v1/servers/{serverid}/stacks/{stackname}/files/chown":    true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/files/stats":     true,

	"GET /api/v1/servers/{serverid}/stacks":                         true,
	"GET /api/v1/servers/{serverid}/stacks/can-create":              true,
	"POST /api/v1/servers/{serverid}/stacks":                        true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}":             true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/permissions": true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/networks":    true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/volumes":     true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/environment": true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/images":      true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/stats":       true,
	"GET /api/v1/servers/{serverid}/stacks/{stackname}/compose":     true,
	"PATCH /api/v1/servers/{serverid}/stacks/{stackname}/compose":   true,

	"POST /api/v1/admin/migration/import": true,
}

func TestAllJSONResponsesUseEnvelope(t *testing.T) {
	apiDoc := apidocs.NewOpenAPI()
	RegisterAPIDocs(apiDoc)
	spec := apiDoc.Spec()

	if spec.Paths == nil || spec.Paths.Len() == 0 {
		t.Fatal("OpenAPI spec has no paths; api_docs.go did not register anything")
	}

	seen := make(map[string]bool)

	for path, item := range spec.Paths.Map() {
		if item == nil {
			continue
		}
		for method, op := range item.Operations() {
			if op == nil {
				continue
			}
			key := method + " " + path
			seen[key] = true

			if envelopeExempt[key] {
				continue
			}
			allowed := legacyEnvelopeAllowlist[key]

			endpointEnvelope := true
			endpointSawJSON := false

			for status, respRef := range op.Responses.Map() {
				if status == "default" || respRef == nil || respRef.Value == nil {
					continue
				}
				media, ok := respRef.Value.Content["application/json"]
				if !ok || media == nil || media.Schema == nil {
					continue
				}
				endpointSawJSON = true

				schema := resolveSchema(media.Schema, spec.Components.Schemas)
				if schema == nil {
					t.Errorf("%s [%s]: response schema could not be resolved", key, status)
					endpointEnvelope = false
					continue
				}
				if !hasEnvelopeShape(schema) {
					if !allowed {
						t.Errorf("%s [%s]: response schema is not the envelope shape (missing top-level success/data); use response.Response[T]{} or response.ErrorResponseBody{}", key, status)
					}
					endpointEnvelope = false
				}
			}

			if !endpointSawJSON {
				continue
			}

			if endpointEnvelope && allowed {
				t.Errorf("%s: every documented JSON response is on the envelope shape, but the endpoint is in legacyEnvelopeAllowlist; remove it from the allowlist", key)
			}
		}
	}

	for key := range legacyEnvelopeAllowlist {
		if !seen[key] {
			t.Errorf("legacyEnvelopeAllowlist contains %q but no such endpoint is documented", key)
		}
	}
	for key := range envelopeExempt {
		if !seen[key] {
			t.Errorf("envelopeExempt contains %q but no such endpoint is documented", key)
		}
	}
}

func resolveSchema(ref *openapi3.SchemaRef, components openapi3.Schemas) *openapi3.Schema {
	if ref == nil {
		return nil
	}
	if ref.Value != nil {
		return ref.Value
	}
	name := strings.TrimPrefix(ref.Ref, "#/components/schemas/")
	if c, ok := components[name]; ok && c != nil {
		return c.Value
	}
	return nil
}

func hasEnvelopeShape(schema *openapi3.Schema) bool {
	if schema == nil || schema.Properties == nil {
		return false
	}
	for _, prop := range []string{"success", "data", "error", "meta"} {
		if _, ok := schema.Properties[prop]; !ok {
			return false
		}
	}
	return true
}
