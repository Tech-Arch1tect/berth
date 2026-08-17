package main

import (
	"os"

	"berth/internal/cli/openapi"
)

func main() {
	os.Exit(openapi.Run(os.Args[1:], os.Stdout, os.Stderr))
}
