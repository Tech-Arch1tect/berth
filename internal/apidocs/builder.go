package apidocs

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/labstack/echo/v4"
	"gopkg.in/yaml.v3"
)

type OpenAPI struct {
	spec               *openapi3.T
	mu                 sync.RWMutex
	schemaRegistry     map[string]string
	schemaNameRegistry map[string]string
}

func New(title, version string) *OpenAPI {
	spec := &openapi3.T{
		OpenAPI: "3.0.3",
		Info: &openapi3.Info{
			Title:   title,
			Version: version,
		},
		Paths:      openapi3.NewPaths(),
		Components: &openapi3.Components{},
	}

	return &OpenAPI{
		spec:               spec,
		schemaRegistry:     make(map[string]string),
		schemaNameRegistry: make(map[string]string),
	}
}

func (o *OpenAPI) Description(desc string) *OpenAPI {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.spec.Info.Description = desc
	return o
}

func (o *OpenAPI) License(name, url string) *OpenAPI {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.spec.Info.License = &openapi3.License{
		Name: name,
		URL:  url,
	}
	return o
}

func (o *OpenAPI) Tag(name, description string) *OpenAPI {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.spec.Tags = append(o.spec.Tags, &openapi3.Tag{
		Name:        name,
		Description: description,
	})
	return o
}

func (o *OpenAPI) BearerAuth(name, description string) *OpenAPI {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.ensureSecuritySchemes()
	o.spec.Components.SecuritySchemes[name] = &openapi3.SecuritySchemeRef{
		Value: &openapi3.SecurityScheme{
			Type:         "http",
			Scheme:       "bearer",
			BearerFormat: "JWT",
			Description:  description,
		},
	}
	return o
}

func (o *OpenAPI) CookieAuth(name, cookieName, description string) *OpenAPI {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.ensureSecuritySchemes()
	o.spec.Components.SecuritySchemes[name] = &openapi3.SecuritySchemeRef{
		Value: &openapi3.SecurityScheme{
			Type:        "apiKey",
			Name:        cookieName,
			In:          "cookie",
			Description: description,
		},
	}
	return o
}

func (o *OpenAPI) ensureSecuritySchemes() {
	if o.spec.Components.SecuritySchemes == nil {
		o.spec.Components.SecuritySchemes = make(openapi3.SecuritySchemes)
	}
}

func (o *OpenAPI) JSON() ([]byte, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()
	return json.MarshalIndent(o.spec, "", "  ")
}

func (o *OpenAPI) YAML() ([]byte, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	intermediate, err := o.spec.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return yaml.Marshal(intermediate)
}

func (o *OpenAPI) JSONHandler() echo.HandlerFunc {
	return func(c echo.Context) error {
		data, err := o.JSON()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSONBlob(http.StatusOK, data)
	}
}

func (o *OpenAPI) YAMLHandler() echo.HandlerFunc {
	return func(c echo.Context) error {
		data, err := o.YAML()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		c.Response().Header().Set("Content-Type", "application/yaml")
		return c.Blob(http.StatusOK, "application/yaml", data)
	}
}

func (o *OpenAPI) SwaggerUIHandler(specPath string) echo.HandlerFunc {
	html := `<!DOCTYPE html>
<html>
<head>
    <title>API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: "` + specPath + `",
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
            layout: "BaseLayout"
        });
    </script>
</body>
</html>`
	return func(c echo.Context) error {
		return c.HTML(http.StatusOK, html)
	}
}

func (o *OpenAPI) Document(method, path string) *RouteBuilder {
	return &RouteBuilder{
		openapi:   o,
		method:    method,
		path:      path,
		operation: &openapi3.Operation{Responses: openapi3.NewResponses()},
	}
}

func (o *OpenAPI) addOperation(method, path string, op *openapi3.Operation) {
	o.mu.Lock()
	defer o.mu.Unlock()

	openAPIPath := echoPathToOpenAPI(path)

	pathItem := o.spec.Paths.Find(openAPIPath)
	if pathItem == nil {
		pathItem = &openapi3.PathItem{}
		o.spec.Paths.Set(openAPIPath, pathItem)
	}

	switch strings.ToUpper(method) {
	case http.MethodGet:
		pathItem.Get = op
	case http.MethodPost:
		pathItem.Post = op
	case http.MethodPut:
		pathItem.Put = op
	case http.MethodDelete:
		pathItem.Delete = op
	case http.MethodPatch:
		pathItem.Patch = op
	case http.MethodHead:
		pathItem.Head = op
	case http.MethodOptions:
		pathItem.Options = op
	}
}

func echoPathToOpenAPI(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, ":") {
			parts[i] = "{" + strings.TrimPrefix(part, ":") + "}"
		}
	}
	return strings.Join(parts, "/")
}

func (o *OpenAPI) generateSchema(example any) *openapi3.SchemaRef {
	o.mu.Lock()
	defer o.mu.Unlock()

	if example == nil {
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"object"}}}
	}

	visited := make(map[string]bool)
	return o.generateSchemaFromType(reflect.TypeOf(example), visited, false)
}

func getTypeKey(t reflect.Type) string {
	if t.PkgPath() != "" {
		return t.PkgPath() + "." + t.Name()
	}
	return t.String()
}

func (o *OpenAPI) generateSchemaFromType(t reflect.Type, visited map[string]bool, inline bool) *openapi3.SchemaRef {
	if t.Kind() == reflect.Pointer {
		elemType := t.Elem()
		innerRef := o.generateSchemaFromType(elemType, visited, inline)

		if innerRef.Ref != "" {
			return &openapi3.SchemaRef{
				Value: &openapi3.Schema{
					AllOf:    openapi3.SchemaRefs{innerRef},
					Nullable: true,
				},
			}
		}

		if innerRef.Value != nil {
			innerRef.Value.Nullable = true
		}
		return innerRef
	}

	switch t.Kind() {
	case reflect.String:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"string"}}}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"integer"}}}
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"integer"}, Min: ptr(0.0)}}
	case reflect.Float32, reflect.Float64:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"number"}}}
	case reflect.Bool:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"boolean"}}}
	case reflect.Slice, reflect.Array:
		return &openapi3.SchemaRef{
			Value: &openapi3.Schema{
				Type:  &openapi3.Types{"array"},
				Items: o.generateSchemaFromType(t.Elem(), visited, false),
			},
		}
	case reflect.Map:
		return &openapi3.SchemaRef{
			Value: &openapi3.Schema{
				Type: &openapi3.Types{"object"},
				AdditionalProperties: openapi3.AdditionalProperties{
					Schema: o.generateSchemaFromType(t.Elem(), visited, false),
				},
			},
		}
	case reflect.Struct:
		return o.generateStructSchema(t, visited, inline)
	case reflect.Interface:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"object"}}}
	default:
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"object"}}}
	}
}

func (o *OpenAPI) generateStructSchema(t reflect.Type, visited map[string]bool, inline bool) *openapi3.SchemaRef {
	if t.PkgPath() == "time" && t.Name() == "Time" {
		return &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"string"}, Format: "date-time"}}
	}

	typeKey := getTypeKey(t)

	if inline {
		return &openapi3.SchemaRef{Value: o.buildStructSchema(t, visited)}
	}

	if t.Name() != "" && t.PkgPath() != "" {
		if registeredName, exists := o.schemaRegistry[typeKey]; exists {
			return &openapi3.SchemaRef{Ref: "#/components/schemas/" + registeredName}
		}

		schemaName := t.Name()
		if existingTypeKey, nameExists := o.schemaNameRegistry[schemaName]; nameExists && existingTypeKey != typeKey {
			baseName := t.Name()
			suffix := 2
			for {
				schemaName = baseName + strconv.Itoa(suffix)
				if _, taken := o.schemaNameRegistry[schemaName]; !taken {
					break
				}
				suffix++
			}
		}

		o.schemaRegistry[typeKey] = schemaName
		o.schemaNameRegistry[schemaName] = typeKey

		schema := o.buildStructSchema(t, visited)

		if o.spec.Components.Schemas == nil {
			o.spec.Components.Schemas = make(openapi3.Schemas)
		}
		o.spec.Components.Schemas[schemaName] = &openapi3.SchemaRef{Value: schema}

		return &openapi3.SchemaRef{Ref: "#/components/schemas/" + schemaName}
	}

	return &openapi3.SchemaRef{Value: o.buildStructSchema(t, visited)}
}

func (o *OpenAPI) buildStructSchema(t reflect.Type, visited map[string]bool) *openapi3.Schema {
	typeKey := getTypeKey(t)

	if typeKey != "" && visited[typeKey] {
		return &openapi3.Schema{Type: &openapi3.Types{"object"}}
	}

	if typeKey != "" {
		visited[typeKey] = true
		defer func() { delete(visited, typeKey) }()
	}

	schema := &openapi3.Schema{
		Type:       &openapi3.Types{"object"},
		Properties: make(openapi3.Schemas),
	}

	var required []string

	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		if !field.IsExported() {
			continue
		}

		jsonTag := field.Tag.Get("json")
		if jsonTag == "-" {
			continue
		}

		inlineField := field.Tag.Get("openapi") == "inline"

		if field.Anonymous && jsonTag == "" {
			fieldType := field.Type
			if fieldType.Kind() == reflect.Pointer {
				fieldType = fieldType.Elem()
			}
			if fieldType.Kind() == reflect.Struct {
				embeddedRef := o.generateStructSchema(fieldType, visited, false)
				var embeddedSchema *openapi3.Schema
				if embeddedRef.Ref != "" {
					refName := strings.TrimPrefix(embeddedRef.Ref, "#/components/schemas/")
					if schemaRef, ok := o.spec.Components.Schemas[refName]; ok {
						embeddedSchema = schemaRef.Value
					}
				} else {
					embeddedSchema = embeddedRef.Value
				}

				if embeddedSchema != nil {
					for propName, propSchema := range embeddedSchema.Properties {
						schema.Properties[propName] = propSchema
					}
					required = append(required, embeddedSchema.Required...)
				}
				continue
			}
		}

		name := field.Name
		tagParts := strings.Split(jsonTag, ",")
		if len(tagParts) > 0 && tagParts[0] != "" {
			name = tagParts[0]
		}

		isOptional := false
		for _, part := range tagParts[1:] {
			if part == "omitempty" {
				isOptional = true
				break
			}
		}

		fieldSchemaRef := o.generateSchemaFromType(field.Type, visited, inlineField)

		if fieldSchemaRef.Ref != "" {
			doc := field.Tag.Get("doc")
			ex := field.Tag.Get("example")
			if doc != "" || ex != "" {
				wrapper := &openapi3.Schema{
					AllOf: openapi3.SchemaRefs{fieldSchemaRef},
				}
				if doc != "" {
					wrapper.Description = doc
				}
				if ex != "" {
					wrapper.Example = ex
				}
				fieldSchemaRef = &openapi3.SchemaRef{Value: wrapper}
			}
		} else if fieldSchemaRef.Value != nil {
			if doc := field.Tag.Get("doc"); doc != "" {
				fieldSchemaRef.Value.Description = doc
			}
			if ex := field.Tag.Get("example"); ex != "" {
				fieldSchemaRef.Value.Example = ex
			}
		}

		schema.Properties[name] = fieldSchemaRef

		if !isOptional {
			required = append(required, name)
		}
	}

	if len(required) > 0 {
		schema.Required = required
	}

	return schema
}

func ptr[T any](v T) *T {
	return &v
}
