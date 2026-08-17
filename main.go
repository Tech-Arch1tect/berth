package main

import (
	"os"

	"berth/internal/app"
	"berth/internal/cli/openapi"
	"berth/internal/cli/setupadmin"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "openapi":
			os.Exit(openapi.Run(os.Args[2:], os.Stdout, os.Stderr))
		case "setup-admin":
			os.Exit(setupadmin.Run(os.Args[2:], os.Stdout, os.Stderr))
		}
	}
	app.Run()
}
