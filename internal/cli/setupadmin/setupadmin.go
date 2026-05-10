package setupadmin

import (
	"flag"
	"fmt"
	"io"
	"strings"

	"berth/internal/app"
	"berth/internal/domain/auth"
	"berth/internal/domain/rbac"
	"berth/internal/domain/setup"
	"berth/internal/platform/logging"
)

func Run(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("setup-admin", flag.ContinueOnError)
	fs.SetOutput(stderr)

	username := fs.String("username", "", "admin username (required)")
	email := fs.String("email", "", "admin email address (required)")
	password := fs.String("password", "", "admin password (required)")

	if err := fs.Parse(args); err != nil {
		return 2
	}

	missing := []string{}
	if strings.TrimSpace(*username) == "" {
		missing = append(missing, "--username")
	}
	if strings.TrimSpace(*email) == "" {
		missing = append(missing, "--email")
	}
	if *password == "" {
		missing = append(missing, "--password")
	}
	if len(missing) > 0 {
		fmt.Fprintf(stderr, "missing required flag(s): %s\n", strings.Join(missing, ", "))
		fs.Usage()
		return 2
	}

	cfg, err := app.LoadConfig()
	if err != nil {
		fmt.Fprintf(stderr, "load config: %v\n", err)
		return 1
	}

	logger, err := logging.NewLogger(cfg)
	if err != nil {
		fmt.Fprintf(stderr, "init logger: %v\n", err)
		return 1
	}
	defer func() { _ = logger.Sync() }()

	db, err := app.OpenDatabase(cfg, logger, app.DatabaseModels()...)
	if err != nil {
		fmt.Fprintf(stderr, "open database: %v\n", err)
		return 1
	}

	rbacSvc := rbac.NewService(db, logger)
	authSvc := auth.NewService(cfg, db, nil, nil, logger)
	setupSvc := setup.NewService(db, rbacSvc, logger)

	exists, err := setupSvc.AdminExists()
	if err != nil {
		fmt.Fprintf(stderr, "check admin existence: %v\n", err)
		return 1
	}
	if exists {
		fmt.Fprintln(stderr, "admin user already exists; refusing to create another")
		return 1
	}

	hashed, err := authSvc.HashPassword(*password)
	if err != nil {
		fmt.Fprintf(stderr, "%v\n", err)
		return 1
	}

	created, err := setupSvc.CreateAdmin(*username, *email, hashed)
	if err != nil {
		fmt.Fprintf(stderr, "create admin: %v\n", err)
		return 1
	}

	fmt.Fprintf(stdout, "admin user created: id=%d username=%s email=%s\n",
		created.ID, created.Username, created.Email)
	return 0
}
