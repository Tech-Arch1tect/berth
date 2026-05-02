package apidocs

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"testing"
)

type sampleData struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type sampleEnvelope[T any] struct {
	Success bool `json:"success"`
	Data    T    `json:"data"`
}

type sampleEmptyEnvelope = sampleEnvelope[struct{}]

var validRefName = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)

func TestSanitiseSchemaName(t *testing.T) {
	cases := map[string]string{
		"VersionData": "VersionData",
		"Response[berth/internal/domain/version.VersionData]": "Response_VersionData",
		"Response[struct {}]":           "Response_Empty",
		"Response[]":                    "Response_Empty",
		"Pair[berth/foo.A,berth/bar.B]": "Pair_A_B",
	}
	for in, want := range cases {
		got := sanitiseSchemaName(in)
		if got != want {
			t.Errorf("sanitiseSchemaName(%q) = %q, want %q", in, got, want)
		}
		if !validRefName.MatchString(got) {
			t.Errorf("sanitiseSchemaName(%q) = %q is not a valid $ref name", in, got)
		}
	}
}

func TestGenericSchemaProducesValidRefNames(t *testing.T) {
	o := NewOpenAPI()
	o.Document(http.MethodGet, "/sample").
		Tags("test").
		Summary("sample").
		Response(http.StatusOK, sampleEnvelope[sampleData]{}, "ok").
		Response(http.StatusInternalServerError, sampleEmptyEnvelope{}, "err").
		Build()

	raw, err := o.JSON()
	if err != nil {
		t.Fatalf("OpenAPI JSON: %v", err)
	}

	var spec struct {
		Components struct {
			Schemas map[string]json.RawMessage `json:"schemas"`
		} `json:"components"`
		Paths map[string]struct {
			Get struct {
				Responses map[string]struct {
					Content map[string]struct {
						Schema struct {
							Ref string `json:"$ref"`
						} `json:"schema"`
					} `json:"content"`
				} `json:"responses"`
			} `json:"get"`
		} `json:"paths"`
	}
	if err := json.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("decode spec: %v\n%s", err, raw)
	}

	for name := range spec.Components.Schemas {
		if !validRefName.MatchString(name) {
			t.Errorf("schema component name %q contains characters invalid for OpenAPI $ref", name)
		}
		if strings.ContainsAny(name, "[],/ {}") {
			t.Errorf("schema component name %q contains forbidden characters", name)
		}
	}

	op := spec.Paths["/sample"].Get
	for status, resp := range op.Responses {
		if status == "default" {
			continue
		}
		ref := resp.Content["application/json"].Schema.Ref
		if ref == "" {
			t.Errorf("status %s: missing $ref", status)
			continue
		}
		shortName := strings.TrimPrefix(ref, "#/components/schemas/")
		if !validRefName.MatchString(shortName) {
			t.Errorf("status %s: $ref %q references invalid schema name", status, ref)
		}
		if _, ok := spec.Components.Schemas[shortName]; !ok {
			t.Errorf("status %s: $ref %q has no matching schema", status, ref)
		}
	}
}

func TestGenericEnvelopeSchemaShape(t *testing.T) {
	o := NewOpenAPI()
	o.Document(http.MethodGet, "/sample").
		Tags("test").
		Summary("sample").
		Response(http.StatusOK, sampleEnvelope[sampleData]{}, "ok").
		Build()

	raw, err := o.JSON()
	if err != nil {
		t.Fatalf("OpenAPI JSON: %v", err)
	}
	var spec struct {
		Components struct {
			Schemas map[string]struct {
				Properties map[string]struct {
					Ref  string `json:"$ref"`
					Type string `json:"type"`
				} `json:"properties"`
				Required []string `json:"required"`
			} `json:"schemas"`
		} `json:"components"`
	}
	if err := json.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("decode: %v", err)
	}

	env, ok := spec.Components.Schemas["sampleEnvelope_sampleData"]
	if !ok {
		var keys []string
		for k := range spec.Components.Schemas {
			keys = append(keys, k)
		}
		t.Fatalf("expected schema sampleEnvelope_sampleData, got: %v", keys)
	}
	if _, ok := env.Properties["success"]; !ok {
		t.Errorf("envelope missing success property")
	}
	dataProp, ok := env.Properties["data"]
	if !ok {
		t.Errorf("envelope missing data property")
	}
	if !strings.HasSuffix(dataProp.Ref, "/sampleData") {
		t.Errorf("data property: got ref %q, want suffix /sampleData", dataProp.Ref)
	}
}
