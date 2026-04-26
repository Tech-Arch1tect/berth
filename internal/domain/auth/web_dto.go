package auth

type LoginFormRequest struct {
	Username   string `form:"username" json:"username"`
	Password   string `form:"password" json:"password"`
	RememberMe bool   `form:"remember_me" json:"remember_me"`
}

type PasswordResetRequestForm struct {
	Email string `form:"email" json:"email"`
}

type PasswordResetConfirmForm struct {
	Token           string `form:"token" json:"token"`
	Password        string `form:"password" json:"password"`
	PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
}

type ResendVerificationForm struct {
	Email string `form:"email" json:"email"`
}

type TOTPVerifyForm struct {
	Code string `form:"code" json:"code"`
}
