package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"time"

	"berth/internal/domain/auth/tokens"
	"berth/internal/domain/auth/totp"
	"berth/internal/domain/authz"
	"berth/internal/domain/security"
	"berth/internal/domain/session"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type apiAuditLogger interface {
	LogAPIEvent(eventType string, userID *uint, username, ip, userAgent string, success bool, failureReason string, metadata map[string]any) error
	LogAuthEvent(eventType string, userID *uint, username, ip, userAgent string, success bool, failureReason string, metadata map[string]any) error
}

type APIHandler struct {
	db         *gorm.DB
	authSvc    *Service
	tokens     *tokens.Service
	totpSvc    *totp.Service
	sessionSvc *session.Service
	logger     *zap.Logger
	auditSvc   apiAuditLogger
}

func extractAccessJTI(c echo.Context, t *tokens.Service) (string, error) {
	authHeader := c.Request().Header.Get("Authorization")
	if len(authHeader) <= 7 || authHeader[:7] != "Bearer " {
		return "", fmt.Errorf("missing bearer token")
	}
	return t.ExtractJTI(authHeader[7:])
}

func NewAPIHandler(db *gorm.DB, authSvc *Service, tokensSvc *tokens.Service, totpSvc *totp.Service, sessionSvc *session.Service, logger *zap.Logger, auditSvc apiAuditLogger) *APIHandler {
	return &APIHandler{
		db:         db,
		authSvc:    authSvc,
		tokens:     tokensSvc,
		totpSvc:    totpSvc,
		sessionSvc: sessionSvc,
		logger:     logger,
		auditSvc:   auditSvc,
	}
}

func (h *APIHandler) Login(c echo.Context) error {
	var req AuthLoginRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	h.logger.Info("mobile login attempt",
		zap.String("username", req.Username),
		zap.String("remote_ip", c.RealIP()),
		zap.String("user_agent", c.Request().UserAgent()),
	)

	var user usermodel.User
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
		return response.Err(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
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
		return response.Err(c, http.StatusUnauthorized, "invalid_credentials", "Invalid username or password")
	}

	if h.authSvc.IsEmailVerificationRequired() && !h.authSvc.IsEmailVerified(user.Email) {
		return response.Err(c, http.StatusForbidden, "email_not_verified", "Please verify your email before signing in")
	}

	if h.totpSvc.IsUserTOTPEnabled(user.ID) {
		temporaryToken, err := h.tokens.IssueTOTPPendingToken(user.ID)
		if err != nil {
			h.logger.Error("failed to generate TOTP token",
				zap.Uint("user_id", user.ID),
				zap.Error(err),
			)
			return response.Err(c, http.StatusInternalServerError, "token_generation_failed", "Failed to generate authentication token")
		}

		h.logger.Info("mobile login - TOTP required",
			zap.String("username", req.Username),
			zap.Uint("user_id", user.ID),
			zap.String("remote_ip", c.RealIP()),
		)

		return response.OK(c, AuthTOTPRequiredData{
			Message:        "Two-factor authentication required",
			TOTPRequired:   true,
			TemporaryToken: temporaryToken,
		})
	}

	accessToken, err := h.tokens.IssueAccessToken(user.ID)
	if err != nil {
		h.logger.Error("failed to generate access token",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
		return response.Err(c, http.StatusInternalServerError, "token_generation_failed", "Failed to generate authentication token")
	}

	sessionInfo := tokens.SessionInfo{
		IPAddress:  c.RealIP(),
		UserAgent:  c.Request().UserAgent(),
		DeviceInfo: GetDeviceInfo(c.Request().UserAgent()),
	}

	refreshTokenData, err := h.tokens.IssueRefresh(user.ID, sessionInfo)
	if err != nil {
		h.logger.Error("failed to generate refresh token",
			zap.Uint("user_id", user.ID),
			zap.Error(err),
		)
		return response.Err(c, http.StatusInternalServerError, "token_generation_failed", "Failed to generate refresh token")
	}

	setRefreshCookie(c, refreshTokenData.Token, refreshTokenData.ExpiresAt)

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

	userInfo := usermodel.ToUserInfo(user, h.totpSvc.IsUserTOTPEnabled(user.ID))

	return response.OK(c, AuthLoginData{
		AccessToken:      accessToken,
		RefreshToken:     refreshTokenData.Token,
		TokenType:        "Bearer",
		ExpiresIn:        h.tokens.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(refreshTokenData.ExpiresAt).Seconds()),
		User:             userInfo,
	})
}

func (h *APIHandler) RefreshToken(c echo.Context) error {
	var req AuthRefreshRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	refreshToken := req.RefreshToken
	if refreshToken == "" {
		refreshToken = readRefreshCookie(c)
	}
	if refreshToken == "" {
		return response.Err(c, http.StatusBadRequest, "missing_refresh_token", "Refresh token is required (in body or berth_refresh cookie)")
	}

	oldToken, validateErr := h.tokens.ValidateRefresh(refreshToken)
	if validateErr != nil {
		switch validateErr {
		case tokens.ErrRefreshExpired:
			return response.Err(c, http.StatusUnauthorized, "expired_token", "Refresh token has expired")
		case tokens.ErrRefreshNotFound, tokens.ErrRefreshInvalid:
			return response.Err(c, http.StatusUnauthorized, "invalid_token", "Invalid refresh token")
		default:
			h.logger.Error("failed to validate refresh token", zap.Error(validateErr))
			return response.Err(c, http.StatusInternalServerError, "token_refresh_failed", "Failed to refresh token")
		}
	}

	var user usermodel.User
	if err := h.db.First(&user, oldToken.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Err(c, http.StatusUnauthorized, "invalid_token", "Invalid refresh token")
		}
		h.logger.Error("failed to load user during token refresh", zap.Error(err))
		return response.Err(c, http.StatusInternalServerError, "token_refresh_failed", "Failed to refresh token")
	}

	result, err := h.tokens.RotateRefresh(refreshToken)
	if err != nil {
		h.logger.Error("failed to rotate refresh token", zap.Error(err))
		return response.Err(c, http.StatusInternalServerError, "token_refresh_failed", "Failed to refresh token")
	}

	setRefreshCookie(c, result.RefreshToken, result.ExpiresAt)

	if h.sessionSvc != nil {
		accessJTI, _ := h.tokens.ExtractJTI(result.AccessToken)
		err = h.sessionSvc.UpdateJWTSessionWithRefreshToken(result.OldTokenID, accessJTI, result.RefreshTokenID, result.ExpiresAt)
		if err != nil {
			h.logger.Warn("failed to update JWT session after token refresh",
				zap.Uint("old_refresh_token_id", result.OldTokenID),
				zap.Uint("new_refresh_token_id", result.RefreshTokenID),
				zap.Error(err),
			)
		}
	}

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

	return response.OK(c, AuthRefreshData{
		AccessToken:      result.AccessToken,
		RefreshToken:     result.RefreshToken,
		TokenType:        "Bearer",
		ExpiresIn:        h.tokens.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(result.ExpiresAt).Seconds()),
	})
}

func (h *APIHandler) Profile(c echo.Context) error {
	p, err := authz.RequirePrincipal(c)
	if err != nil {
		return err
	}

	if p.Key() != nil {
		var owner usermodel.User
		if err := h.db.Where("id = ?", p.UserID()).First(&owner).Error; err != nil {
			return response.Err(c, http.StatusInternalServerError, "database_error", "Failed to load user profile")
		}
		return response.OK(c, usermodel.ToUserIdentity(owner))
	}

	var fullUser usermodel.User
	if err := h.db.Preload("Roles").Where("id = ?", p.UserID()).First(&fullUser).Error; err != nil {
		return response.Err(c, http.StatusInternalServerError, "database_error", "Failed to load user profile")
	}

	userInfo := usermodel.ToUserInfo(fullUser, h.totpSvc.IsUserTOTPEnabled(fullUser.ID))

	return response.OK(c, userInfo)
}

func (h *APIHandler) Logout(c echo.Context) error {
	var req AuthLogoutRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	clearRefreshCookie(c)

	refreshToken := req.RefreshToken
	if refreshToken == "" {
		refreshToken = readRefreshCookie(c)
	}

	var revokedTokens []string

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken := authHeader[7:]

		accessJTI, err := h.tokens.ExtractJTI(accessToken)
		if err != nil {
			h.logger.Warn("failed to extract JTI from access token during logout",
				zap.Error(err))
		} else {
			if err := h.tokens.RevokeToken(accessJTI, time.Now().Add(24*time.Hour)); err != nil {
				h.logger.Warn("failed to revoke access token JTI during logout",
					zap.String("jti", accessJTI),
					zap.Error(err))
			} else {
				revokedTokens = append(revokedTokens, "access_token")
			}
		}

		if h.sessionSvc != nil && refreshToken != "" {
			refresh, err := h.tokens.ValidateRefresh(refreshToken)
			if err == nil {
				sessionToken := h.generateSessionTokenFromID(refresh.ID)
				_ = h.sessionSvc.RemoveSessionByToken(sessionToken)
			}
		}
	}

	if refreshToken != "" {
		if err := h.tokens.RevokeRefresh(refreshToken); err != nil {
			h.logger.Warn("failed to revoke refresh token during logout",
				zap.Error(err))
		} else {
			revokedTokens = append(revokedTokens, "refresh_token")
		}
	}

	if len(revokedTokens) == 0 {
		h.logger.Error("failed to revoke any tokens during logout")
		return response.Err(c, http.StatusInternalServerError, "logout_failed", "Failed to revoke tokens")
	}

	user := GetCurrentUser(c)
	if user != nil {
		if userModel, ok := user.(usermodel.User); ok {
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

	return response.OK(c, AuthLogoutData{
		Message:       "Logout successful. Tokens have been revoked.",
		RevokedTokens: revokedTokens,
	})
}

func (h *APIHandler) VerifyTOTP(c echo.Context) error {
	var req AuthTOTPVerifyRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	authHeader := c.Request().Header.Get("Authorization")
	if authHeader == "" || len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Missing or invalid authorization header")
	}

	tokenString := authHeader[7:]
	claims, err := h.tokens.ValidateTOTPPending(tokenString)
	if err != nil {
		if errors.Is(err, tokens.ErrInvalidTokenType) {
			return response.Err(c, http.StatusUnauthorized, "invalid_token_type", "Invalid token for TOTP verification")
		}
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
	}

	if err := h.totpSvc.VerifyUserCode(claims.UserID, req.Code); err != nil {
		var user usermodel.User
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
			return response.Err(c, http.StatusUnauthorized, "invalid_totp_code", "Invalid TOTP code")
		case totp.ErrCodeAlreadyUsed:
			return response.Err(c, http.StatusUnauthorized, "code_already_used", "TOTP code has already been used")
		}
		h.logger.Error("TOTP verification failed",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return response.Err(c, http.StatusInternalServerError, "totp_verification_failed", "Failed to verify TOTP code")
	}

	var user usermodel.User
	if err := h.db.First(&user, claims.UserID).Error; err != nil {
		return response.Err(c, http.StatusInternalServerError, "user_not_found", "User not found")
	}

	accessToken, err := h.tokens.IssueAccessToken(claims.UserID)
	if err != nil {
		h.logger.Error("failed to generate access token after TOTP verification",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return response.Err(c, http.StatusInternalServerError, "token_generation_failed", "Failed to generate authentication token")
	}

	sessionInfo := tokens.SessionInfo{
		IPAddress:  c.RealIP(),
		UserAgent:  c.Request().UserAgent(),
		DeviceInfo: GetDeviceInfo(c.Request().UserAgent()),
	}

	refreshTokenData, err := h.tokens.IssueRefresh(claims.UserID, sessionInfo)
	if err != nil {
		h.logger.Error("failed to generate refresh token after TOTP verification",
			zap.Uint("user_id", claims.UserID),
			zap.Error(err),
		)
		return response.Err(c, http.StatusInternalServerError, "token_generation_failed", "Failed to generate refresh token")
	}

	setRefreshCookie(c, refreshTokenData.Token, refreshTokenData.ExpiresAt)

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

	return response.OK(c, AuthLoginData{
		AccessToken:      accessToken,
		RefreshToken:     refreshTokenData.Token,
		TokenType:        "Bearer",
		ExpiresIn:        h.tokens.GetAccessExpirySeconds(),
		RefreshExpiresIn: int(time.Until(refreshTokenData.ExpiresAt).Seconds()),
		User:             usermodel.ToUserInfo(user, h.totpSvc.IsUserTOTPEnabled(user.ID)),
	})
}

func (h *APIHandler) GetTOTPSetup(c echo.Context) error {
	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	if h.totpSvc.IsUserTOTPEnabled(userModel.ID) {
		return response.Err(c, http.StatusConflict, "totp_already_enabled", "TOTP is already enabled for your account")
	}

	existing, err := h.totpSvc.GetSecret(userModel.ID)
	if err != nil && err != totp.ErrSecretNotFound {
		return response.Err(c, http.StatusInternalServerError, "totp_setup_failed", "Failed to retrieve TOTP information")
	}

	var secret *totp.TOTPSecret
	if existing != nil {
		secret = existing
	} else {
		secret, err = h.totpSvc.GenerateSecret(userModel.ID, userModel.Email)
		if err != nil {
			return response.Err(c, http.StatusInternalServerError, "totp_setup_failed", "Failed to generate TOTP secret")
		}
	}

	qrCodeURI, err := h.totpSvc.GenerateProvisioningURI(secret, userModel.Email)
	if err != nil {
		return response.Err(c, http.StatusInternalServerError, "totp_setup_failed", "Failed to generate QR code")
	}

	return response.OK(c, TOTPSetupData{
		QRCodeURI: qrCodeURI,
		Secret:    secret.Secret,
	})
}

func (h *APIHandler) EnableTOTP(c echo.Context) error {
	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	var req TOTPEnableRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.totpSvc.EnableTOTP(userModel.ID, req.Code); err != nil {
		if err == totp.ErrInvalidCode {
			return response.Err(c, http.StatusBadRequest, "invalid_totp_code", "Invalid TOTP code. Please try again.")
		}
		return response.Err(c, http.StatusInternalServerError, "totp_enable_failed", "Failed to enable TOTP")
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

	return response.OK(c, TOTPMessageData{
		Message: "Two-factor authentication has been enabled successfully",
	})
}

func (h *APIHandler) DisableTOTP(c echo.Context) error {
	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	var req TOTPDisableRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if err := h.authSvc.VerifyPassword(userModel.Password, req.Password); err != nil {
		return response.Err(c, http.StatusUnauthorized, "invalid_password", "Invalid password")
	}

	if err := h.totpSvc.VerifyUserCode(userModel.ID, req.Code); err != nil {
		return response.Err(c, http.StatusUnauthorized, "invalid_totp_code", "Invalid TOTP code")
	}

	if err := h.totpSvc.DisableTOTP(userModel.ID); err != nil {
		return response.Err(c, http.StatusInternalServerError, "totp_disable_failed", "Failed to disable TOTP")
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

	return response.OK(c, TOTPMessageData{
		Message: "Two-factor authentication has been disabled",
	})
}

func (h *APIHandler) GetTOTPStatus(c echo.Context) error {
	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	enabled := h.totpSvc.IsUserTOTPEnabled(userModel.ID)

	return response.OK(c, TOTPStatusData{Enabled: enabled})
}

func (h *APIHandler) GetSessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return response.Err(c, http.StatusServiceUnavailable, "sessions_unavailable", "Session service not available")
	}

	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	var currentToken string
	if accessJTI, jtiErr := extractAccessJTI(c, h.tokens); jtiErr == nil {
		if token, lookupErr := h.sessionSvc.GetCurrentSessionToken(userModel.ID, accessJTI); lookupErr == nil {
			currentToken = token
		}
	}

	sessions, err := h.sessionSvc.GetUserSessions(userModel.ID, currentToken)
	if err != nil {
		return response.Err(c, http.StatusInternalServerError, "sessions_fetch_failed", "Failed to retrieve sessions")
	}

	sessionItems := make([]session.SessionItem, len(sessions))
	for i, sess := range sessions {
		deviceInfo := GetDeviceInfo(sess.UserAgent)

		sessionItems[i] = session.SessionItem{
			ID:         sess.ID,
			UserID:     sess.UserID,
			Token:      sess.Token,
			Type:       string(sess.Type),
			Current:    sess.Current,
			IPAddress:  sess.IPAddress,
			UserAgent:  sess.UserAgent,
			Location:   GetLocationInfo(sess.IPAddress),
			Browser:    toString(deviceInfo["browser"]),
			OS:         toString(deviceInfo["os"]),
			DeviceType: toString(deviceInfo["device_type"]),
			Device:     toString(deviceInfo["device"]),
			Mobile:     toBool(deviceInfo["mobile"]),
			Tablet:     toBool(deviceInfo["tablet"]),
			Desktop:    toBool(deviceInfo["desktop"]),
			Bot:        toBool(deviceInfo["bot"]),
			CreatedAt:  sess.CreatedAt,
			LastUsed:   sess.LastUsed,
			ExpiresAt:  sess.ExpiresAt,
		}
	}

	return response.OK(c, session.GetSessionsData{Sessions: sessionItems})
}

func (h *APIHandler) RevokeSession(c echo.Context) error {
	if h.sessionSvc == nil {
		return response.Err(c, http.StatusServiceUnavailable, "sessions_unavailable", "Session service not available")
	}

	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	var req session.RevokeSessionRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	err := h.sessionSvc.RevokeSession(userModel.ID, req.SessionID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Err(c, http.StatusNotFound, "session_not_found", "Session not found")
		}
		return response.Err(c, http.StatusInternalServerError, "session_revoke_failed", "Failed to revoke session")
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

	return response.OK(c, session.SessionMessageData{
		Message: "Session revoked successfully",
	})
}

func (h *APIHandler) RevokeAllOtherSessions(c echo.Context) error {
	if h.sessionSvc == nil {
		return response.Err(c, http.StatusServiceUnavailable, "sessions_unavailable", "Session service not available")
	}

	user := GetCurrentUser(c)
	if user == nil {
		return response.Err(c, http.StatusUnauthorized, "unauthorized", "Invalid or missing authentication token")
	}

	userModel, ok := user.(usermodel.User)
	if !ok {
		return response.Err(c, http.StatusInternalServerError, "user_data_error", "Failed to process user data")
	}

	var req session.RevokeAllOtherSessionsRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	accessJTI, err := extractAccessJTI(c, h.tokens)
	if err != nil {
		return response.Err(c, http.StatusBadRequest, "invalid_session", "Could not identify current session")
	}
	currentToken, err := h.sessionSvc.GetCurrentSessionToken(userModel.ID, accessJTI)
	if err != nil {
		return response.Err(c, http.StatusBadRequest, "invalid_session", "Current session not found")
	}

	err = h.sessionSvc.RevokeAllOtherSessions(userModel.ID, currentToken)
	if err != nil {
		return response.Err(c, http.StatusInternalServerError, "sessions_revoke_failed", "Failed to revoke other sessions")
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

	return response.OK(c, session.SessionMessageData{
		Message: "All other sessions revoked successfully",
	})
}

func (h *APIHandler) generateSessionTokenFromID(refreshTokenID uint) string {
	hash := sha256.Sum256(fmt.Appendf(nil, "refresh_token_id_%d", refreshTokenID))
	return hex.EncodeToString(hash[:])
}

func (h *APIHandler) trackJWTSession(c echo.Context, userID uint, accessToken string, refreshTokenData *tokens.RefreshTokenData) {
	if h.sessionSvc == nil {
		return
	}

	ipAddress := c.RealIP()
	userAgent := c.Request().UserAgent()

	accessJTI, _ := h.tokens.ExtractJTI(accessToken)
	err := h.sessionSvc.TrackJWTSessionWithRefreshToken(userID, accessJTI, refreshTokenData.TokenID, ipAddress, userAgent, refreshTokenData.ExpiresAt)
	if err != nil {
		h.logger.Warn("failed to track JWT session",
			zap.Uint("user_id", userID),
			zap.Error(err),
		)
	}
}

func toString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func toBool(v any) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return false
}
