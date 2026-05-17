package authz

type Kind int

const (
	KindAuthenticated Kind = iota
	KindServerAccess
	KindServer
	KindStack
	KindAdmin
	KindAPIKeyScope
)

type Requirement struct {
	Kind       Kind
	Permission string
	ServerID   uint
	Stack      string
}
