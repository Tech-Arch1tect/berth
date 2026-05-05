package stack

import "errors"

var ErrStackNameRequired = errors.New("stack name is required")

type CreateStackRequest struct {
	Name string `json:"name"`
}

func (r *CreateStackRequest) Validate() error {
	if r.Name == "" {
		return ErrStackNameRequired
	}
	return nil
}
