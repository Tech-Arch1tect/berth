package session

import "berth/models"

type (
	SessionType = models.SessionType
	UserSession = models.UserSession
)

const (
	SessionTypeWeb = models.SessionTypeWeb
	SessionTypeJWT = models.SessionTypeJWT
)
