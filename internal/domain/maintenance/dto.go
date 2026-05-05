package maintenance

import "errors"

var (
	ErrPruneTypeRequired = errors.New("Prune type is required")
	ErrPruneTypeInvalid  = errors.New("Invalid prune type")

	ErrDeleteTypeRequired = errors.New("Resource type is required")
	ErrDeleteIDRequired   = errors.New("Resource ID is required")
	ErrDeleteTypeInvalid  = errors.New("Invalid resource type")
)

var validPruneTypes = map[string]struct{}{
	"images":      {},
	"containers":  {},
	"volumes":     {},
	"networks":    {},
	"build-cache": {},
	"system":      {},
}

var validDeleteTypes = map[string]struct{}{
	"image":     {},
	"container": {},
	"volume":    {},
	"network":   {},
}

type PruneRequest struct {
	Type    string `json:"type"`
	Force   bool   `json:"force"`
	All     bool   `json:"all"`
	Filters string `json:"filters"`
}

func (r *PruneRequest) Validate() error {
	if r.Type == "" {
		return ErrPruneTypeRequired
	}
	if _, ok := validPruneTypes[r.Type]; !ok {
		return ErrPruneTypeInvalid
	}
	return nil
}

type DeleteRequest struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

func (r *DeleteRequest) Validate() error {
	if r.Type == "" {
		return ErrDeleteTypeRequired
	}
	if r.ID == "" {
		return ErrDeleteIDRequired
	}
	if _, ok := validDeleteTypes[r.Type]; !ok {
		return ErrDeleteTypeInvalid
	}
	return nil
}
