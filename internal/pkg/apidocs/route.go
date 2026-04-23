package apidocs

import (
	"net/http"
	"strconv"

	"github.com/getkin/kin-openapi/openapi3"
)

type RouteBuilder struct {
	openapi   *OpenAPI
	method    string
	path      string
	operation *openapi3.Operation
}

func (rb *RouteBuilder) Summary(summary string) *RouteBuilder {
	rb.operation.Summary = summary
	return rb
}

func (rb *RouteBuilder) Description(description string) *RouteBuilder {
	rb.operation.Description = description
	return rb
}

func (rb *RouteBuilder) Tags(tags ...string) *RouteBuilder {
	rb.operation.Tags = append(rb.operation.Tags, tags...)
	return rb
}

func (rb *RouteBuilder) PathParam(name, description string) *ParamBuilder {
	param := rb.findOrCreateParam(name, "path")
	param.Description = description
	param.Required = true
	return &ParamBuilder{route: rb, param: param}
}

func (rb *RouteBuilder) QueryParam(name, description string) *ParamBuilder {
	param := rb.findOrCreateParam(name, "query")
	param.Description = description
	return &ParamBuilder{route: rb, param: param}
}

func (rb *RouteBuilder) findOrCreateParam(name, in string) *openapi3.Parameter {
	for _, p := range rb.operation.Parameters {
		if p.Value != nil && p.Value.Name == name && p.Value.In == in {
			return p.Value
		}
	}

	param := &openapi3.Parameter{
		Name:   name,
		In:     in,
		Schema: &openapi3.SchemaRef{Value: &openapi3.Schema{Type: &openapi3.Types{"string"}}},
	}
	rb.operation.Parameters = append(rb.operation.Parameters, &openapi3.ParameterRef{Value: param})
	return param
}

func (rb *RouteBuilder) Body(example any, description string) *RouteBuilder {
	schemaRef := rb.openapi.generateSchema(example)

	rb.operation.RequestBody = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: description,
			Required:    true,
			Content: openapi3.Content{
				"application/json": &openapi3.MediaType{
					Schema: schemaRef,
				},
			},
		},
	}
	return rb
}

func (rb *RouteBuilder) BodyMultipart(description string) *MultipartBuilder {
	return &MultipartBuilder{
		route:       rb,
		description: description,
		properties:  make(openapi3.Schemas),
		required:    []string{},
	}
}

type MultipartBuilder struct {
	route       *RouteBuilder
	description string
	properties  openapi3.Schemas
	required    []string
}

func (mb *MultipartBuilder) Field(name string, required bool) *MultipartBuilder {
	mb.properties[name] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{Type: &openapi3.Types{"string"}},
	}
	if required {
		mb.required = append(mb.required, name)
	}
	return mb
}

func (mb *MultipartBuilder) FileField(name string, required bool) *MultipartBuilder {
	mb.properties[name] = &openapi3.SchemaRef{
		Value: &openapi3.Schema{
			Type:   &openapi3.Types{"string"},
			Format: "binary",
		},
	}
	if required {
		mb.required = append(mb.required, name)
	}
	return mb
}

func (mb *MultipartBuilder) Done() *RouteBuilder {
	mb.route.operation.RequestBody = &openapi3.RequestBodyRef{
		Value: &openapi3.RequestBody{
			Description: mb.description,
			Required:    len(mb.required) > 0,
			Content: openapi3.Content{
				"multipart/form-data": &openapi3.MediaType{
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:       &openapi3.Types{"object"},
							Properties: mb.properties,
							Required:   mb.required,
						},
					},
				},
			},
		},
	}
	return mb.route
}

func (mb *MultipartBuilder) Response(statusCode int, example any, description string) *RouteBuilder {
	mb.Done()
	return mb.route.Response(statusCode, example, description)
}

func (rb *RouteBuilder) ResponseBinary(statusCode int, contentType, description string) *RouteBuilder {
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	rb.operation.Responses.Set(statusCodeToString(statusCode), &openapi3.ResponseRef{
		Value: &openapi3.Response{
			Description: &description,
			Content: openapi3.Content{
				contentType: &openapi3.MediaType{
					Schema: &openapi3.SchemaRef{
						Value: &openapi3.Schema{
							Type:   &openapi3.Types{"string"},
							Format: "binary",
						},
					},
				},
			},
		},
	})

	return rb
}

func (rb *RouteBuilder) Response(statusCode int, example any, description string) *RouteBuilder {
	var content openapi3.Content

	if example != nil {
		schemaRef := rb.openapi.generateSchema(example)
		content = openapi3.Content{
			"application/json": &openapi3.MediaType{
				Schema: schemaRef,
			},
		}
	}

	rb.operation.Responses.Set(statusCodeToString(statusCode), &openapi3.ResponseRef{
		Value: &openapi3.Response{
			Description: &description,
			Content:     content,
		},
	})

	return rb
}

func (rb *RouteBuilder) Security(schemes ...string) *RouteBuilder {
	if rb.operation.Security == nil {
		rb.operation.Security = &openapi3.SecurityRequirements{}
	}
	for _, scheme := range schemes {
		req := openapi3.SecurityRequirement{}
		req[scheme] = []string{}
		*rb.operation.Security = append(*rb.operation.Security, req)
	}
	return rb
}

func (rb *RouteBuilder) Build() {
	rb.openapi.addOperation(rb.method, rb.path, rb.operation)
}

func statusCodeToString(code int) string {
	switch code {
	case http.StatusOK:
		return "200"
	case http.StatusCreated:
		return "201"
	case http.StatusAccepted:
		return "202"
	case http.StatusNoContent:
		return "204"
	case http.StatusBadRequest:
		return "400"
	case http.StatusUnauthorized:
		return "401"
	case http.StatusForbidden:
		return "403"
	case http.StatusNotFound:
		return "404"
	case http.StatusMethodNotAllowed:
		return "405"
	case http.StatusConflict:
		return "409"
	case http.StatusUnprocessableEntity:
		return "422"
	case http.StatusTooManyRequests:
		return "429"
	case http.StatusInternalServerError:
		return "500"
	case http.StatusBadGateway:
		return "502"
	case http.StatusServiceUnavailable:
		return "503"
	default:
		return strconv.Itoa(code)
	}
}

type ParamBuilder struct {
	route *RouteBuilder
	param *openapi3.Parameter
}

func (pb *ParamBuilder) Required() *RouteBuilder {
	pb.param.Required = true
	return pb.route
}

func (pb *ParamBuilder) Optional() *RouteBuilder {
	pb.param.Required = false
	return pb.route
}

func (pb *ParamBuilder) TypeInt() *ParamBuilder {
	pb.param.Schema.Value.Type = &openapi3.Types{"integer"}
	return pb
}

func (pb *ParamBuilder) TypeBool() *ParamBuilder {
	pb.param.Schema.Value.Type = &openapi3.Types{"boolean"}
	return pb
}

func (pb *ParamBuilder) Enum(values ...string) *ParamBuilder {
	for _, v := range values {
		pb.param.Schema.Value.Enum = append(pb.param.Schema.Value.Enum, v)
	}
	return pb
}

func (pb *ParamBuilder) Default(value any) *ParamBuilder {
	pb.param.Schema.Value.Default = value
	return pb
}

func (pb *ParamBuilder) Min(min float64) *ParamBuilder {
	pb.param.Schema.Value.Min = &min
	return pb
}

func (pb *ParamBuilder) Max(max float64) *ParamBuilder {
	pb.param.Schema.Value.Max = &max
	return pb
}

func (pb *ParamBuilder) QueryParam(name, description string) *ParamBuilder {
	return pb.route.QueryParam(name, description)
}

func (pb *ParamBuilder) Response(statusCode int, example any, description string) *RouteBuilder {
	return pb.route.Response(statusCode, example, description)
}
