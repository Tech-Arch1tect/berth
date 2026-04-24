package stack

import (
	"berth/internal/domain/rbac"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	"berth/internal/pkg/echoparams"
	"berth/internal/pkg/response"
	"strings"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type stackAuditLogger interface {
	LogStackEvent(eventType string, actorUserID uint, actorUsername string, serverID uint, stackName, ip string, metadata map[string]any) error
}

type APIHandler struct {
	service      *Service
	logger       *zap.Logger
	auditService stackAuditLogger
	db           *gorm.DB
}

func NewAPIHandler(service *Service, logger *zap.Logger, auditService stackAuditLogger, db *gorm.DB) *APIHandler {
	return &APIHandler{
		service:      service,
		logger:       logger,
		auditService: auditService,
		db:           db,
	}
}

func (h *APIHandler) ListServerStacks(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	stacks, err := h.service.ListStacksForServer(c.Request().Context(), userID, serverID)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, ListStacksResponse{
		Success: true,
		Data:    ListStacksData{Stacks: stacks},
	})
}

func (h *APIHandler) CreateStack(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	var req CreateStackRequest
	if err := c.Bind(&req); err != nil {
		return response.SendBadRequest(c, "invalid request body")
	}

	if req.Name == "" {
		return response.SendBadRequest(c, "stack name is required")
	}

	h.logger.Debug("creating stack via API",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", req.Name),
	)

	stack, err := h.service.CreateStack(c.Request().Context(), userID, serverID, req.Name)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "permission denied") {
			return response.SendForbidden(c, errMsg)
		}
		if strings.Contains(errMsg, "already exists") {
			return response.SendConflict(c, errMsg)
		}
		return response.SendBadRequest(c, errMsg)
	}

	user, _ := session.LoadCurrentUser(c, h.db)
	username := ""
	if user != nil {
		username = user.Username
	}

	h.auditService.LogStackEvent(
		security.EventStackCreated,
		userID,
		username,
		serverID,
		req.Name,
		c.RealIP(),
		nil,
	)

	return response.SendCreated(c, CreateStackResponse{
		Success: true,
		Data: CreateStackData{
			Stack:   stack,
			Message: "Stack created successfully",
		},
	})
}

func (h *APIHandler) GetStackDetails(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	stackDetails, err := h.service.GetStackDetails(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, stackDetails)
}

func (h *APIHandler) GetStackNetworks(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	networks, err := h.service.GetStackNetworks(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, StackNetworksResponse{
		Success: true,
		Data:    StackNetworksData{Networks: networks},
	})
}

func (h *APIHandler) GetStackVolumes(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	volumes, err := h.service.GetStackVolumes(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, StackVolumesResponse{
		Success: true,
		Data:    StackVolumesData{Volumes: volumes},
	})
}

func (h *APIHandler) GetContainerImageDetails(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	imageDetails, err := h.service.GetContainerImageDetails(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, StackImagesResponse{
		Success: true,
		Data:    StackImagesData{Images: imageDetails},
	})
}

func (h *APIHandler) GetStackEnvironmentVariables(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	unmask := c.QueryParam("unmask") == "true"

	h.logger.Debug("fetching stack environment variables",
		zap.Uint("user_id", userID),
		zap.Uint("server_id", serverID),
		zap.String("stack_name", stackname),
		zap.Bool("unmask", unmask),
	)

	environmentVariables, err := h.service.GetStackEnvironmentVariables(c.Request().Context(), userID, serverID, stackname, unmask)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	if unmask {
		user, _ := session.LoadCurrentUser(c, h.db)
		username := ""
		if user != nil {
			username = user.Username
		}

		h.auditService.LogStackEvent(
			security.EventStackSecretsViewed,
			userID,
			username,
			serverID,
			stackname,
			c.RealIP(),
			map[string]any{
				"unmasked": true,
			},
		)
	}

	h.logger.Debug("returning environment variables",
		zap.Int("service_count", len(environmentVariables)),
		zap.Strings("services", func() []string {
			keys := make([]string, 0, len(environmentVariables))
			for k := range environmentVariables {
				keys = append(keys, k)
			}
			return keys
		}()),
	)

	return response.SendSuccess(c, StackEnvironmentResponse{
		Success: true,
		Data:    StackEnvironmentData{Services: environmentVariables},
	})
}

func (h *APIHandler) GetStackStats(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	stackStats, err := h.service.GetStackStats(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, StackStatsResponse{
		Success: true,
		Data:    StackStatsData{StackStats: *stackStats},
	})
}

func (h *APIHandler) CheckPermissions(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	permissions, err := h.service.rbacSvc.GetUserStackPermissions(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, "Failed to get user permissions")
	}

	return response.SendSuccess(c, StackPermissionsResponse{
		Success: true,
		Data:    StackPermissionsData{Permissions: permissions},
	})
}

func (h *APIHandler) CheckCanCreateStack(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, err := echoparams.ParseUintParam(c, "serverid")
	if err != nil {
		return err
	}

	canCreate, err := h.service.rbacSvc.UserHasAnyStackPermission(c.Request().Context(), userID, serverID, rbac.PermStacksCreate)
	if err != nil {
		return response.SendInternalError(c, "Failed to check permissions")
	}

	return response.SendSuccess(c, CanCreateStackResponse{
		Success: true,
		Data:    CanCreateStackData{CanCreate: canCreate},
	})
}

func (h *APIHandler) GetComposeConfig(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	composeConfig, err := h.service.GetComposeConfig(c.Request().Context(), userID, serverID, stackname)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, composeConfig)
}

func (h *APIHandler) UpdateCompose(c echo.Context) error {
	userID, err := session.GetCurrentUserID(c)
	if err != nil {
		return err
	}

	serverID, stackname, err := echoparams.GetServerIDAndStackName(c)
	if err != nil {
		return err
	}

	var req UpdateComposeRequest
	if err := c.Bind(&req); err != nil {
		return response.SendBadRequest(c, "invalid request body")
	}

	result, err := h.service.UpdateCompose(c.Request().Context(), userID, serverID, stackname, &req)
	if err != nil {
		return response.SendInternalError(c, err.Error())
	}

	return response.SendSuccess(c, result)
}
