package s3buckets

import (
	"berth/internal/domain/authz"
	"berth/internal/domain/rbac/permnames"
)

func (h *APIHandler) RegisterAdminAPIRoutes(reg *authz.Registrar) {
	read := authz.Admin(permnames.AdminServersRead)
	write := authz.Admin(permnames.AdminServersWrite)
	reg.GET("/s3-buckets", h.ListBuckets, read)
	reg.GET("/s3-buckets/:id", h.GetBucket, read)
	reg.POST("/s3-buckets", h.CreateBucket, write)
	reg.PUT("/s3-buckets/:id", h.UpdateBucket, write)
	reg.DELETE("/s3-buckets/:id", h.DeleteBucket, write)
}
