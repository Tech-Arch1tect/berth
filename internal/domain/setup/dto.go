package setup

type CreateInitialAdminForm struct {
	Username        string `form:"username" json:"username"`
	Email           string `form:"email" json:"email"`
	Password        string `form:"password" json:"password"`
	PasswordConfirm string `form:"password_confirm" json:"password_confirm"`
}
