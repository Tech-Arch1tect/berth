package app

import (
	"fmt"
	"time"

	"berth/internal/pkg/config"

	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func OpenDatabase(cfg *config.Config, logger *zap.Logger, models ...any) (*gorm.DB, error) {
	logger.Info("initialising database connection",
		zap.String("driver", cfg.Database.Driver),
		zap.Bool("auto_migrate", cfg.Database.AutoMigrate))

	startTime := time.Now()

	var (
		db  *gorm.DB
		err error
	)
	switch cfg.Database.Driver {
	case "sqlite":
		db, err = gorm.Open(sqlite.Open(cfg.Database.DSN), &gorm.Config{})
	case "postgres", "postgresql":
		db, err = gorm.Open(postgres.Open(cfg.Database.DSN), &gorm.Config{})
	case "mysql":
		db, err = gorm.Open(mysql.Open(cfg.Database.DSN), &gorm.Config{})
	default:
		return nil, fmt.Errorf("unsupported database driver: %s (supported: sqlite, postgres, mysql)", cfg.Database.Driver)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	logger.Info("database connection established",
		zap.String("driver", cfg.Database.Driver),
		zap.Duration("connection_time", time.Since(startTime)))

	if cfg.Database.AutoMigrate && len(models) > 0 {
		migrationStart := time.Now()
		if err := db.AutoMigrate(models...); err != nil {
			return nil, fmt.Errorf("failed to auto-migrate models: %w", err)
		}
		logger.Info("auto-migration completed",
			zap.Int("model_count", len(models)),
			zap.Duration("migration_duration", time.Since(migrationStart)))
	}

	return db, nil
}
