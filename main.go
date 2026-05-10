package main

import (
	"fmt"
	"os"

	"berth/internal/app"
	"berth/internal/cli/setupadmin"
	"berth/internal/pkg/apidocs"
	"berth/routes"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "openapi":
			generateOpenAPI()
			return
		case "setup-admin":
			os.Exit(setupadmin.Run(os.Args[2:], os.Stdout, os.Stderr))
		}
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
