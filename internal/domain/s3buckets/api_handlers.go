package s3buckets

import (
	"errors"

	"berth/internal/domain/authz"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
)

type securityAuditor interface {
	LogS3BucketEvent(eventType string, actorUserID uint, actorUsername string, bucketID uint, label string, ip string, metadata map[string]any) error
}

type APIHandler struct {
	service     *Service
	securityLog securityAuditor
}

func NewAPIHandler(service *Service, securityLog securityAuditor) *APIHandler {
	return &APIHandler{service: service, securityLog: securityLog}
}

func (h *APIHandler) audit(c echo.Context, p authz.Principal, eventType string, bucketID uint, label string, extra map[string]any) {
	metadata := map[string]any{"label": label}
	for key, value := range extra {
		metadata[key] = value
	}
	_ = h.securityLog.LogS3BucketEvent(
		eventType,
		p.UserID(),
		session.ResolveUsername(c),
		bucketID,
		label,
		c.RealIP(),
		metadata,
	)
}

func (h *APIHandler) ListBuckets(c echo.Context) error {
	result, err := h.service.List(c.Request().Context())
	if err != nil {
		return response.Internal(c, err.Error())
	}
	return response.OK(c, result.Buckets)
}

func (h *APIHandler) GetBucket(c echo.Context) error {
	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	result, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, ErrBucketNotFound) {
			return response.NotFound(c, "bucket configuration not found")
		}
		return response.Internal(c, err.Error())
	}
	return response.OK(c, result)
}

func (h *APIHandler) CreateBucket(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	var req CreateRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}
	if err := req.Validate(); err != nil {
		return response.BadRequest(c, err.Error())
	}

	result, err := h.service.Create(c.Request().Context(), req)
	if err != nil {
		return response.Internal(c, err.Error())
	}

	h.audit(c, p, security.EventS3BucketCreated, result.ID, result.Label, map[string]any{
		"endpoint":    result.Endpoint,
		"bucket_name": result.BucketName,
	})

	return response.OK(c, result)
}

func (h *APIHandler) UpdateBucket(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	var req UpdateRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}
	if err := req.Validate(); err != nil {
		return response.BadRequest(c, err.Error())
	}

	result, err := h.service.Update(c.Request().Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrBucketNotFound) {
			return response.NotFound(c, "bucket configuration not found")
		}
		return response.Internal(c, err.Error())
	}

	h.audit(c, p, security.EventS3BucketUpdated, result.ID, result.Label, map[string]any{
		"secret_rotated": req.SecretKey != "",
	})

	return response.OK(c, result)
}

func (h *APIHandler) DeleteBucket(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	id, err := echoparams.ParseUintParam(c, "id")
	if err != nil {
		return err
	}

	if err := h.service.Delete(c.Request().Context(), id); err != nil {
		if errors.Is(err, ErrBucketNotFound) {
			return response.NotFound(c, "bucket configuration not found")
		}
		if errors.Is(err, ErrBucketInUse) || errors.Is(err, ErrBucketBusy) {
			return response.Conflict(c, err.Error())
		}
		return response.Internal(c, err.Error())
	}

	h.audit(c, p, security.EventS3BucketDeleted, id, "", nil)

	return response.OK(c, DeleteResponse{Message: "bucket configuration deleted"})
}
