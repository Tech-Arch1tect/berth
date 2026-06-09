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

var legacyEnvelopeAllowlist = map[string]bool{}

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
				if status == "101" && op.Extensions["x-websocket"] == true {
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
				if !hasEnvelopeShape(schema, spec.Components.Schemas) {
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

func hasEnvelopeShape(schema *openapi3.Schema, components openapi3.Schemas) bool {
	if schema == nil {
		return false
	}
	if len(schema.OneOf) > 0 {
		for _, variant := range schema.OneOf {
			v := resolveSchema(variant, components)
			if !hasEnvelopeShape(v, components) {
				return false
			}
		}
		return true
	}
	if schema.Properties == nil {
		return false
	}
	for _, prop := range []string{"success", "data", "error", "meta"} {
		if _, ok := schema.Properties[prop]; !ok {
			return false
		}
	}
	return true
}
