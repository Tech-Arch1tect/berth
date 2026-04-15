package session

import (
	"fmt"

	"github.com/alexedwards/scs/gormstore"
	"github.com/alexedwards/scs/v2"
	"github.com/alexedwards/scs/v2/memstore"
	"gorm.io/gorm"
)

func NewMemoryStore() scs.Store {
	return memstore.New()
}

func NewDatabaseStore(db *gorm.DB) (scs.Store, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection cannot be nil")
	}
	store, err := gormstore.NewWithCleanupInterval(db, 0)
	return store, err
}
