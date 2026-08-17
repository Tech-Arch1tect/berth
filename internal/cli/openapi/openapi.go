package openapi

import (
	"fmt"
	"io"

	"berth/internal/pkg/apidocs"
	"berth/routes"
)

func Run(args []string, stdout, stderr io.Writer) int {
	apiDoc := apidocs.NewOpenAPI()
	routes.RegisterAPIDocs(apiDoc)

	useYAML := len(args) > 0 && (args[0] == "--yaml" || args[0] == "yaml")

	var data []byte
	var err error
	if useYAML {
		data, err = apiDoc.YAML()
	} else {
		data, err = apiDoc.JSON()
	}

	if err != nil {
		fmt.Fprintf(stderr, "Error generating OpenAPI spec: %v\n", err)
		return 1
	}

	fmt.Fprintln(stdout, string(data))
	return 0
}
