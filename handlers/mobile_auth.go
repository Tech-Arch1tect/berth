package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"berth/internal/dto"
	"berth/internal/rbac"
	"berth/internal/security"
	"berth/models"

	"github.com/labstack/echo/v4"
	"github.com/tech-arch1tect/brx/middleware/jwtshared"
	"github.com/tech-arch1tect/brx/services/auth"
	jwtservice "github.com/tech-arch1tect/brx/services/jwt"
	"github.com/tech-arch1tect/brx/services/logging"
	"github.com/tech-arch1tect/brx/services/refreshtoken"
	"github.com/tech-arch1tect/brx/services/totp"
	"github.com/tech-arch1tect/brx/session"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type MobileAuthHandler struct {
	db              *gorm.DB
	authSvc         *auth.Service
	jwtSvc          *jwtservice.Service
	refreshTokenSvc refreshtoken.RefreshTokenService
	totpSvc         *totp.Service
	sessionSvc      session.SessionService
	logger          *logging.Service
	rbacSvc         *rbac.Service
	auditSvc        *security.AuditService
}

func NewMobileAuthHandler(db *gorm.DB, authSvc *auth.Service, jwtSvc *jwtservice.Service, refreshTokenSvc refreshtoken.RefreshTokenService, totpSvc *totp.Service, sessionSvc session.SessionService, logger *logging.Service, rbacSvc *rbac.Service, auditSvc *security.AuditService) *MobileAuthHandler {
	return &MobileAuthHandler{
		db:              db,
		authSvc:         authSvc,
		jwtSvc:          jwtSvc,
		refreshTokenSvc: refreshTokenSvc,
		totpSvc:         totpSvc,
		sessionSvc:      sessionSvc,
		logger:          logger,
		rbacSvc:         rbacSvc,
		auditSvc:        auditSvc,
	}
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken      string       `json:"access_token"`
	RefreshToken     string       `json:"refresh_token"`
	TokenType        string       `json:"token_type"`
	ExpiresIn        int          `json:"expires_in"`
	RefreshExpiresIn int          `json:"refresh_expires_in"`
	User             dto.UserInfo `json:"user"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type RefreshResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type TOTPRequiredResponse struct {
	Message        string `json:"message"`
	TOTPRequired   bool   `json:"totp_required"`
	TemporaryToken string `json:"temporary_token"`
}

type TOTPVerifyRequest struct {
	Code string `json:"code" validate:"required"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

func (h *MobileAuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Warn("mobile login - invalid request format",
			zap.String("remote_ip", c.RealIP()),
			zap.Error(err))
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.Username == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Username and password are required",
		})
	}

	h.logger.Info("mobile login attempt",
		zap.String("username", req.Username),
		zap.String("remote_ip", c.RealIP()),
		zap.String("user_agent", c.Request().UserAgent()),
	)

	var user models.User
	if err := h.db.Preload("Roles").Where("username = ?", req.Username).First(&user).Error; err != nil {
		h.logger.Warn("mobile login failed - user not found",
			zap.String("username", req.Username),
			zap.String("remote_ip", c.RealIP()),
		)
		_ = h.auditSvc.LogAPIEvent(
			security.EventAPIAuthFailed,
			nil,
			req.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			false,
			"user not found",
			nil,
		)
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "invalid_credentials",
			Message: "Invalid username or password",
		})
	}

	if err := h.authSvc.VerifyPassword(user.Password, req.Password); err != nil {
		h.logger.Warn("mobile login failed - invalid password",
			zap.String("username", req.Username),
			zap.Uint("user_id", user.ID),
			zap.String("remote_ip", c.RealIP()),
		)
		_ = h.auditSvc.LogAPIEvent(
			security.EventAPIAuthFailed,
			&user.ID,
			req.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			false,
			"invalid password",
			nil,
		)
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "invalid_credentials",
			Message: "Invalid username or password",
		})
	}

	if h.authSvc.IsEmailVerificationRequired() && !h.authSvc.IsEmailVerified(user.Email) {
		return c.JSON(http.StatusForbidden, ErrorResponse{
			Error:   "email_not_verified",
			Message: "Please verify your email before signing in",
		})
	}

	if h.totpSvc.IsUserTOTPEnabled(user.ID) {
		temporaryToken, err := h.jwtSvc.GenerateTOTPToken(user.ID)
		if err != nil {
			h.logger.Error("failed to generate TOTP token",
				zap.Uint("user_id", user.ID),
				zap.Error(err),
			)
			return c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "token_generation_failed",
				Message: "Failed to generate authentication token",
			})
		}

		h.logger.Info("mobile login - TOTP required",
			zap.String("username", req.Username),
			zap.Uint("user_id", user.ID),
			zap.String("remote_ip", c.RealIP()),
		)

		return c.JSON(http.StatusOK, TOTPRequiredResponse{
			Message:        "Two-factor authentication required",
			TOTPRequired:   true,
			TemporaryToken: temporaryToken,
		})
	}

	accessToken, err := h.jwtSvc.GenerateToken(user.ID)
	if err != nil {
		h.logger.Error("failed to generate access token",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "token_generation_failed",
			Message: "Failed to generate authentication token",
		})
	}

	sessionInfo := refreshtoken.TokenSessionInfo{
		IPAddress:  c.RealIP(),
		UserAgent:  c.Request().UserAgent(),
		DeviceInfo: session.GetDeviceInfo(c.Request().UserAgent()),
	}

	refreshTokenData, err := h.refreshTokenSvc.GenerateRefreshToken(user.ID, sessionInfo)
	if err != nil {
		h.logger.Error("failed to generate refresh token",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "token_generation_failed",
			Message: "Failed to generate refresh token",
		})
	}

	h.trackJWTSession(c, user.ID, accessToken, refreshTokenData)

	now := time.Now()
	if err := h.db.Model(&user).Update("last_login_at", now).Error; err != nil {
		h.logger.Warn("failed to update last login time",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
	}

	h.logger.Info("mobile login successful",
		zap.String("username", req.Username),
		zap.Uint("user_id", user.ID),
		zap.String("remote_ip", c.RealIP()),
	)

	_ = h.auditSvc.LogAPIEvent(
		security.EventAPITokenIssued,
		&user.ID,
		req.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	userInfo := dto.ConvertUserToUserInfo(user, h.totpSvc)

	return c.JSON(http.StatusOK, LoginResponse{
		AccessToken:      accessToken,
		RefreshToken:     refreshTokenData.Token,
		TokenType:        "Bearer",
		ExpiresIn:        h.jwtSvc.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(refreshTokenData.ExpiresAt).Seconds()),
		User:             userInfo,
	})
}

func (h *MobileAuthHandler) RefreshToken(c echo.Context) error {
	var req RefreshRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Refresh token is required",
		})
	}

	oldToken, validateErr := h.refreshTokenSvc.ValidateRefreshToken(req.RefreshToken)
	if validateErr != nil {
		switch validateErr {
		case refreshtoken.ErrRefreshTokenExpired:
			return c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "expired_token",
				Message: "Refresh token has expired",
			})
		case refreshtoken.ErrRefreshTokenNotFound, refreshtoken.ErrRefreshTokenInvalid:
			return c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "invalid_token",
				Message: "Invalid refresh token",
			})
		default:
			h.logger.Error("failed to validate refresh token", zap.Error(validateErr))
			return c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "token_refresh_failed",
				Message: "Failed to refresh token",
			})
		}
	}

	result, err := h.refreshTokenSvc.ValidateAndRotateRefreshToken(req.RefreshToken, h.jwtSvc)
	if err != nil {
		h.logger.Error("failed to rotate refresh token", zap.Error(err))
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "token_refresh_failed",
			Message: "Failed to refresh token",
		})
	}

	if h.sessionSvc != nil {
		accessJTI, _ := h.jwtSvc.ExtractJTI(result.AccessToken)
		err = h.sessionSvc.UpdateJWTSessionWithRefreshToken(result.OldTokenID, accessJTI, result.RefreshTokenID, result.ExpiresAt)
		if err != nil {
			h.logger.Warn("failed to update JWT session after token refresh",
				zap.Uint("old_refresh_token_id", result.OldTokenID),
				zap.Uint("new_refresh_token_id", result.RefreshTokenID),
				zap.Error(err),
			)
		}
	}

	var user models.User
	if err := h.db.First(&user, oldToken.UserID).Error; err == nil {
		_ = h.auditSvc.LogAPIEvent(
			security.EventAPITokenRefreshed,
			&user.ID,
			user.Username,
			c.RealIP(),
			c.Request().UserAgent(),
			true,
			"",
			nil,
		)
	}

	return c.JSON(http.StatusOK, RefreshResponse{
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		TokenType:        "Bearer",
		ExpiresIn:        h.jwtSvc.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(result.ExpiresAt).Seconds()),
	})
}

func (h *MobileAuthHandler) Profile(c echo.Context) error {

	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var fullUser models.User
	if err := h.db.Preload("Roles").Where("id = ?", userModel.ID).First(&fullUser).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "database_error",
			Message: "Failed to load user profile",
		})
	}

	userInfo := dto.ConvertUserToUserInfo(fullUser, h.totpSvc)

	return c.JSON(http.StatusOK, userInfo)
}

func (h *MobileAuthHandler) Logout(c echo.Context) error {
	var req LogoutRequest
	if err := c.Bind(&req); err != nil {
		h.logger.Warn("logout - invalid request format",
			zap.String("remote_ip", c.RealIP()),
			zap.Error(err))
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Refresh token is required",
		})
	}

	var revokedTokens []string

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken := authHeader[7:]

		accessJTI, err := h.jwtSvc.ExtractJTI(accessToken)
		if err != nil {
			h.logger.Warn("failed to extract JTI from access token during logout",
				zap.Error(err))
		} else {
			if err := h.jwtSvc.RevokeToken(accessJTI, time.Now().Add(24*time.Hour)); err != nil {
				h.logger.Warn("failed to revoke access token JTI during logout",
					zap.String("jti", accessJTI),
					zap.Error(err))
			} else {
				revokedTokens = append(revokedTokens, "access_token")
			}
		}

		if h.sessionSvc != nil {
			refreshToken, err := h.refreshTokenSvc.ValidateRefreshToken(req.RefreshToken)
			if err == nil {
				sessionToken := h.generateSessionTokenFromID(refreshToken.ID)
				_ = h.sessionSvc.RemoveSessionByToken(sessionToken)
			}
		}
	}

	if err := h.refreshTokenSvc.RevokeRefreshToken(req.RefreshToken); err != nil {
		h.logger.Warn("failed to revoke refresh token during logout",
			zap.Error(err))
	} else {
		revokedTokens = append(revokedTokens, "refresh_token")
	}

	if len(revokedTokens) == 0 {
		h.logger.Error("failed to revoke any tokens during logout")
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "logout_failed",
			Message: "Failed to revoke tokens",
		})
	}

	user := jwtshared.GetCurrentUser(c)
	if user != nil {
		if userModel, ok := user.(models.User); ok {
			_ = h.auditSvc.LogAPIEvent(
				security.EventAPITokenRevoked,
				&userModel.ID,
				userModel.Username,
				c.RealIP(),
				c.Request().UserAgent(),
				true,
				"",
				nil,
			)
		}
	}

	h.logger.Info("logout successful",
		zap.Strings("revoked_tokens", revokedTokens),
		zap.String("remote_ip", c.RealIP()))

	return c.JSON(http.StatusOK, map[string]any{
		"message":        "Logout successful. Tokens have been revoked.",
		"revoked_tokens": revokedTokens,
	})
}

func (h *MobileAuthHandler) VerifyTOTP(c echo.Context) error {
	var req TOTPVerifyRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.Code == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "TOTP code is required",
		})
	}

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" || len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Missing or invalid authorization header",
		})
	}

	tokenString := authHeader[7:]
	claims, err := h.jwtSvc.ValidateToken(tokenString)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or expired token",
		})
	}

	if claims.TokenType != "totp_pending" {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "invalid_token_type",
			Message: "Invalid token for TOTP verification",
		})
	}

	if err := h.totpSvc.VerifyUserCode(claims.UserID, req.Code); err != nil {
		var user models.User
		if dbErr := h.db.First(&user, claims.UserID).Error; dbErr == nil {
			_ = h.auditSvc.LogAPIEvent(
				security.EventAPIAuthFailed,
				&user.ID,
				user.Username,
				c.RealIP(),
				c.Request().UserAgent(),
				false,
				"TOTP verification failed",
				nil,
			)
		}
		switch err {
		case totp.ErrInvalidCode:
			return c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "invalid_totp_code",
				Message: "Invalid TOTP code",
			})
		case totp.ErrCodeAlreadyUsed:
			return c.JSON(http.StatusUnauthorized, ErrorResponse{
				Error:   "code_already_used",
				Message: "TOTP code has already been used",
			})
		}
		h.logger.Error("TOTP verification failed",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "totp_verification_failed",
			Message: "Failed to verify TOTP code",
		})
	}

	var user models.User
	if err := h.db.First(&user, claims.UserID).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_not_found",
			Message: "User not found",
		})
	}

	accessToken, err := h.jwtSvc.GenerateToken(claims.UserID)
	if err != nil {
		h.logger.Error("failed to generate access token after TOTP verification",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "token_generation_failed",
			Message: "Failed to generate authentication token",
		})
	}

	sessionInfo := refreshtoken.TokenSessionInfo{
		IPAddress:  c.RealIP(),
		UserAgent:  c.Request().UserAgent(),
		DeviceInfo: session.GetDeviceInfo(c.Request().UserAgent()),
	}

	refreshTokenData, err := h.refreshTokenSvc.GenerateRefreshToken(claims.UserID, sessionInfo)
	if err != nil {
		h.logger.Error("failed to generate refresh token after TOTP verification",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "token_generation_failed",
			Message: "Failed to generate refresh token",
		})
	}

	h.trackJWTSession(c, claims.UserID, accessToken, refreshTokenData)

	now := time.Now()
	if err := h.db.Model(&user).Update("last_login_at", now).Error; err != nil {
		h.logger.Warn("failed to update last login time",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
	}

	h.logger.Info("TOTP verification successful",
		zap.Uint("user_id", claims.UserID),
		zap.String("remote_ip", c.RealIP()),
	)

	_ = h.auditSvc.LogAPIEvent(
		security.EventAPITokenIssued,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		map[string]any{
			"totp_verified": true,
		},
	)

	return c.JSON(http.StatusOK, LoginResponse{
		AccessToken:      accessToken,
		RefreshToken:     refreshTokenData.Token,
		TokenType:        "Bearer",
		ExpiresIn:        h.jwtSvc.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(refreshTokenData.ExpiresAt).Seconds()),
		User:             dto.ConvertUserToUserInfo(user, h.totpSvc),
	})
}

func (h *MobileAuthHandler) GetTOTPSetup(c echo.Context) error {
	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	if h.totpSvc.IsUserTOTPEnabled(userModel.ID) {
		return c.JSON(http.StatusConflict, ErrorResponse{
			Error:   "totp_already_enabled",
			Message: "TOTP is already enabled for your account",
		})
	}

	existing, err := h.totpSvc.GetSecret(userModel.ID)
	if err != nil && err != totp.ErrSecretNotFound {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "totp_setup_failed",
			Message: "Failed to retrieve TOTP information",
		})
	}

	var secret *totp.TOTPSecret
	if existing != nil {
		secret = existing
	} else {
		secret, err = h.totpSvc.GenerateSecret(userModel.ID, userModel.Email)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "totp_setup_failed",
				Message: "Failed to generate TOTP secret",
			})
		}
	}

	qrCodeURI, err := h.totpSvc.GenerateProvisioningURI(secret, userModel.Email)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "totp_setup_failed",
			Message: "Failed to generate QR code",
		})
	}

	return c.JSON(http.StatusOK, TOTPSetupResponse{
		Success: true,
		Data: TOTPSetupData{
			QRCodeURI: qrCodeURI,
			Secret:    secret.Secret,
		},
	})
}

func (h *MobileAuthHandler) EnableTOTP(c echo.Context) error {
	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var req TOTPEnableRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.Code == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "TOTP code is required",
		})
	}

	if err := h.totpSvc.EnableTOTP(userModel.ID, req.Code); err != nil {
		if err == totp.ErrInvalidCode {
			return c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "invalid_totp_code",
				Message: "Invalid TOTP code. Please try again.",
			})
		}
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "totp_enable_failed",
			Message: "Failed to enable TOTP",
		})
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventTOTPEnabled,
		&userModel.ID,
		userModel.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	if session.IsAuthenticated(c) {
		session.SetTOTPEnabled(c, true)
	}

	return c.JSON(http.StatusOK, TOTPMessageResponse{
		Success: true,
		Message: "Two-factor authentication has been enabled successfully",
	})
}

func (h *MobileAuthHandler) DisableTOTP(c echo.Context) error {
	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var req TOTPDisableRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.Code == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "TOTP code and password are required to disable 2FA",
		})
	}

	if err := h.authSvc.VerifyPassword(userModel.Password, req.Password); err != nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "invalid_password",
			Message: "Invalid password",
		})
	}

	if err := h.totpSvc.VerifyUserCode(userModel.ID, req.Code); err != nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "invalid_totp_code",
			Message: "Invalid TOTP code",
		})
	}

	if err := h.totpSvc.DisableTOTP(userModel.ID); err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "totp_disable_failed",
			Message: "Failed to disable TOTP",
		})
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventTOTPDisabled,
		&userModel.ID,
		userModel.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	if session.IsAuthenticated(c) {
		session.SetTOTPEnabled(c, false)
	}

	return c.JSON(http.StatusOK, TOTPMessageResponse{
		Success: true,
		Message: "Two-factor authentication has been disabled",
	})
}

func (h *MobileAuthHandler) GetTOTPStatus(c echo.Context) error {
	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	enabled := h.totpSvc.IsUserTOTPEnabled(userModel.ID)

	return c.JSON(http.StatusOK, TOTPStatusResponse{
		Success: true,
		Data: TOTPStatusData{
			Enabled: enabled,
		},
	})
}

func (h *MobileAuthHandler) GetSessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "sessions_unavailable",
			Message: "Session service not available",
		})
	}

	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.RefreshToken == "" {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Refresh token is required",
		})
	}

	refreshToken, err := h.refreshTokenSvc.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_token",
			Message: "Invalid refresh token",
		})
	}
	currentToken := h.generateSessionTokenFromID(refreshToken.ID)

	sessions, err := h.sessionSvc.GetUserSessions(userModel.ID, currentToken)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "sessions_fetch_failed",
			Message: "Failed to retrieve sessions",
		})
	}

	sessionData := make([]map[string]any, len(sessions))
	for i, sess := range sessions {
		deviceInfo := session.GetDeviceInfo(sess.UserAgent)

		sessionData[i] = map[string]any{
			"id":          sess.ID,
			"user_id":     sess.UserID,
			"token":       sess.Token,
			"type":        string(sess.Type),
			"current":     sess.Current,
			"ip_address":  sess.IPAddress,
			"user_agent":  sess.UserAgent,
			"location":    session.GetLocationInfo(sess.IPAddress),
			"browser":     deviceInfo["browser"],
			"os":          deviceInfo["os"],
			"device_type": deviceInfo["device_type"],
			"device":      deviceInfo["device"],
			"mobile":      deviceInfo["mobile"],
			"tablet":      deviceInfo["tablet"],
			"desktop":     deviceInfo["desktop"],
			"bot":         deviceInfo["bot"],
			"created_at":  sess.CreatedAt,
			"last_used":   sess.LastUsed,
			"expires_at":  sess.ExpiresAt,
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"sessions": sessionData,
	})
}

func (h *MobileAuthHandler) RevokeSession(c echo.Context) error {
	if h.sessionSvc == nil {
		return c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "sessions_unavailable",
			Message: "Session service not available",
		})
	}

	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var req RevokeSessionRequest

	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "invalid_request",
			Message: "Invalid request format",
		})
	}

	if req.SessionID == 0 {
		return c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "validation_error",
			Message: "Session ID is required",
		})
	}

	err := h.sessionSvc.RevokeSession(userModel.ID, req.SessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "session_revoke_failed",
			Message: "Failed to revoke session",
		})
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthSessionRevoked,
		&userModel.ID,
		userModel.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		map[string]any{
			"session_id": req.SessionID,
		},
	)

	return c.JSON(http.StatusOK, SessionMessageResponse{
		Success: true,
		Message: "Session revoked successfully",
	})
}

func (h *MobileAuthHandler) RevokeAllOtherSessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Error:   "sessions_unavailable",
			Message: "Session service not available",
		})
	}

	user := jwtshared.GetCurrentUser(c)
	if user == nil {
		return c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "unauthorized",
			Message: "Invalid or missing authentication token",
		})
	}

	userModel, ok := user.(models.User)
	if !ok {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "user_data_error",
			Message: "Failed to process user data",
		})
	}

	var currentToken string

	if session.IsAuthenticated(c) {
		manager := session.GetManager(c)
		if manager == nil {
			return c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "session_manager_unavailable",
				Message: "Session manager not available",
			})
		}

		currentToken = manager.Token(c.Request().Context())
		if currentToken == "" {
			return c.JSON(http.StatusInternalServerError, ErrorResponse{
				Error:   "current_session_not_found",
				Message: "Current session token not found",
			})
		}
	} else {

		var req RevokeAllOtherSessionsRequest

		if err := c.Bind(&req); err != nil {
			return c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "invalid_request",
				Message: "Invalid request format",
			})
		}

		if req.RefreshToken == "" {
			return c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "validation_error",
				Message: "Refresh token is required",
			})
		}

		refreshToken, err := h.refreshTokenSvc.ValidateRefreshToken(req.RefreshToken)
		if err != nil {
			return c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "invalid_token",
				Message: "Invalid refresh token",
			})
		}
		currentToken = h.generateSessionTokenFromID(refreshToken.ID)
	}

	err := h.sessionSvc.RevokeAllOtherSessions(userModel.ID, currentToken)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "sessions_revoke_failed",
			Message: "Failed to revoke other sessions",
		})
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthSessionsRevokedAll,
		&userModel.ID,
		userModel.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	return c.JSON(http.StatusOK, SessionMessageResponse{
		Success: true,
		Message: "All other sessions revoked successfully",
	})
}

func (h *MobileAuthHandler) generateSessionTokenFromID(refreshTokenID uint) string {
	hash := sha256.Sum256(fmt.Appendf(nil, "refresh_token_id_%d", refreshTokenID))
	return hex.EncodeToString(hash[:])
}

func (h *MobileAuthHandler) trackJWTSession(c echo.Context, userID uint, accessToken string, refreshTokenData *refreshtoken.RefreshTokenData) {
	if h.sessionSvc == nil {
		return
	}

	ipAddress := c.RealIP()
	userAgent := c.Request().UserAgent()

	accessJTI, _ := h.jwtSvc.ExtractJTI(accessToken)
	err := h.sessionSvc.TrackJWTSessionWithRefreshToken(userID, accessJTI, refreshTokenData.TokenID, ipAddress, userAgent, refreshTokenData.ExpiresAt)
	if err != nil {
		h.logger.Warn("failed to track JWT session",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
	}
}
