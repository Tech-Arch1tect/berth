package auth

import (
	"errors"
	"net/http"
	"strings"

	"berth/internal/domain/security"
	usermodel "berth/internal/domain/user"
	"berth/internal/pkg/response"
	"berth/internal/pkg/validation"

	"github.com/labstack/echo/v4"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	passwordResetGenericMessage     = "If an account with that email exists, you will receive a password reset email shortly."
	emailVerificationGenericMessage = "If an account with that email exists, a verification email will be sent."
	passwordResetSuccessMessage     = "Your password has been reset successfully. Please log in with your new password."
	emailVerifiedMessage            = "Your email has been verified successfully. You can now sign in."
)

func (h *APIHandler) RequestPasswordResetAPI(c echo.Context) error {
	var req AuthPasswordResetRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	var user usermodel.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.OK(c, AuthMessageData{Message: passwordResetGenericMessage})
		}
		h.logger.Error("password reset user lookup failed",
			zap.String("email", req.Email),
			zap.Error(err))
		return response.Err(c, http.StatusInternalServerError, "password_reset_failed", "Something went wrong. Please try again.")
	}

	if err := h.authSvc.RequestPasswordReset(req.Email); err != nil {
		switch {
		case errors.Is(err, ErrPasswordResetDisabled):
			return response.Err(c, http.StatusServiceUnavailable, "password_reset_disabled", "Password reset is currently disabled")
		case strings.Contains(err.Error(), "mail service is not configured"):
			h.logger.Error("password reset mail service unavailable",
				zap.String("email", req.Email),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "mail_service_unavailable", "Email service is not properly configured")
		default:
			h.logger.Error("password reset failed",
				zap.String("email", req.Email),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "password_reset_failed", "Failed to send password reset email")
		}
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthPasswordResetRequested,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	return response.OK(c, AuthMessageData{Message: passwordResetGenericMessage})
}

func (h *APIHandler) ConfirmPasswordResetAPI(c echo.Context) error {
	var req AuthPasswordResetConfirmRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	tokenData, err := h.authSvc.ValidatePasswordResetToken(req.Token)
	if err != nil {
		return passwordResetTokenError(c, err)
	}

	var user usermodel.User
	if err := h.db.Where("email = ?", tokenData.Email).First(&user).Error; err != nil {
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid password reset link")
	}

	if err := h.authSvc.CompletePasswordReset(req.Token, req.Password); err != nil {
		switch {
		case errors.Is(err, ErrPasswordResetTokenExpired),
			errors.Is(err, ErrPasswordResetTokenUsed),
			errors.Is(err, ErrPasswordResetTokenInvalid):
			return passwordResetTokenError(c, err)
		case strings.Contains(err.Error(), "password must"):
			return response.Err(c, http.StatusBadRequest, "weak_password", err.Error())
		default:
			h.logger.Error("password reset completion failed",
				zap.Uint("user_id", user.ID),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "password_reset_failed", "Something went wrong. Please try again.")
		}
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthPasswordResetCompleted,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	return response.OK(c, AuthMessageData{Message: passwordResetSuccessMessage})
}

func (h *APIHandler) VerifyEmailAPI(c echo.Context) error {
	var req AuthVerifyEmailRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	tokenData, err := h.authSvc.ValidateEmailVerificationToken(req.Token)
	if err != nil {
		return emailVerificationTokenError(c, err)
	}

	var user usermodel.User
	if err := h.db.Where("email = ?", tokenData.Email).First(&user).Error; err != nil {
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid verification link")
	}

	if err := h.authSvc.VerifyEmail(req.Token); err != nil {
		switch {
		case errors.Is(err, ErrEmailVerificationTokenExpired),
			errors.Is(err, ErrEmailVerificationTokenUsed),
			errors.Is(err, ErrEmailVerificationTokenInvalid):
			return emailVerificationTokenError(c, err)
		default:
			h.logger.Error("email verification failed",
				zap.Uint("user_id", user.ID),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "email_verification_failed", "Something went wrong. Please try again.")
		}
	}

	_ = h.auditSvc.LogAuthEvent(
		security.EventAuthEmailVerified,
		&user.ID,
		user.Username,
		c.RealIP(),
		c.Request().UserAgent(),
		true,
		"",
		nil,
	)

	return response.OK(c, AuthMessageData{Message: emailVerifiedMessage})
}

func (h *APIHandler) ResendVerificationAPI(c echo.Context) error {
	var req AuthResendVerificationRequest
	if err := validation.BindAndValidate(c, &req); err != nil {
		return err
	}

	if !h.authSvc.IsEmailVerificationRequired() {
		return response.OK(c, AuthMessageData{Message: emailVerificationGenericMessage})
	}

	var user usermodel.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.OK(c, AuthMessageData{Message: emailVerificationGenericMessage})
		}
		h.logger.Error("resend verification user lookup failed",
			zap.String("email", req.Email),
			zap.Error(err))
		return response.Err(c, http.StatusInternalServerError, "email_verification_failed", "Something went wrong. Please try again.")
	}

	if user.EmailVerifiedAt != nil {
		return response.OK(c, AuthMessageData{Message: emailVerificationGenericMessage})
	}

	if err := h.authSvc.RequestEmailVerification(req.Email); err != nil {
		switch {
		case errors.Is(err, ErrEmailVerificationDisabled):
			return response.Err(c, http.StatusServiceUnavailable, "email_verification_disabled", "Email verification is currently disabled")
		case strings.Contains(err.Error(), "mail service is not configured"):
			h.logger.Error("resend verification mail service unavailable",
				zap.String("email", req.Email),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "mail_service_unavailable", "Email service is not properly configured")
		default:
			h.logger.Error("resend verification failed",
				zap.String("email", req.Email),
				zap.Error(err))
			return response.Err(c, http.StatusInternalServerError, "email_verification_failed", "Failed to send verification email")
		}
	}

	return response.OK(c, AuthMessageData{Message: emailVerificationGenericMessage})
}

func passwordResetTokenError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrPasswordResetTokenExpired):
		return response.Err(c, http.StatusBadRequest, "expired_token", "This password reset link has expired. Please request a new one.")
	case errors.Is(err, ErrPasswordResetTokenUsed):
		return response.Err(c, http.StatusBadRequest, "used_token", "This password reset link has already been used.")
	case errors.Is(err, ErrPasswordResetTokenInvalid):
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid password reset link.")
	case errors.Is(err, ErrPasswordResetDisabled):
		return response.Err(c, http.StatusServiceUnavailable, "password_reset_disabled", "Password reset is currently disabled")
	default:
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid password reset link.")
	}
}

func emailVerificationTokenError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, ErrEmailVerificationTokenExpired):
		return response.Err(c, http.StatusBadRequest, "expired_token", "This verification link has expired. Please request a new one.")
	case errors.Is(err, ErrEmailVerificationTokenUsed):
		return response.Err(c, http.StatusBadRequest, "used_token", "This email has already been verified.")
	case errors.Is(err, ErrEmailVerificationTokenInvalid):
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid verification link.")
	case errors.Is(err, ErrEmailVerificationDisabled):
		return response.Err(c, http.StatusServiceUnavailable, "email_verification_disabled", "Email verification is currently disabled")
	default:
		return response.Err(c, http.StatusBadRequest, "invalid_token", "Invalid verification link.")
	}
}
