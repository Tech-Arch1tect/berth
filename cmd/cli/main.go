package main

import (
	"os"

	"berth/internal/cli/commands"
)

func main() {
	if err := commands.Execute(); err != nil {
		os.Exit(1)
	}
}
