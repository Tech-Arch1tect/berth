package main

import (
	"fmt"
	"os"

	"berth/internal/apidocs"
	"berth/internal/app"
	"berth/routes"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "openapi" {
		generateOpenAPI()
		return
	}
	app.Run()
}

func generateOpenAPI() {
	apiDoc := apidocs.NewOpenAPI()
	routes.RegisterAPIDocs(apiDoc)

	useYAML := len(os.Args) > 2 && (os.Args[2] == "--yaml" || os.Args[2] == "yaml")

	var data []byte
	var err error
	if useYAML {
		data, err = apiDoc.YAML()
	} else {
		data, err = apiDoc.JSON()
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating OpenAPI spec: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(data))
}
