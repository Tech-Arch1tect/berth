package server

import "berth/models"

type AdminListServersResponse struct {
	Success bool                         `json:"success"`
	Data    AdminListServersResponseData `json:"data"`
}

type AdminListServersResponseData struct {
	Servers []models.ServerInfo `json:"servers"`
}

type AdminCreateServerRequest = models.ServerCreateRequest

type AdminCreateServerResponse struct {
	Success bool                          `json:"success"`
	Data    AdminCreateServerResponseData `json:"data"`
}

type AdminCreateServerResponseData struct {
	Server models.ServerInfo `json:"server"`
}

type AdminUpdateServerRequest = models.ServerUpdateRequest

type AdminUpdateServerResponse struct {
	Success bool                          `json:"success"`
	Data    AdminUpdateServerResponseData `json:"data"`
}

type AdminUpdateServerResponseData struct {
	Server models.ServerInfo `json:"server"`
}

type AdminDeleteServerResponse struct {
	Success bool                          `json:"success"`
	Data    AdminDeleteServerResponseData `json:"data"`
}

type AdminDeleteServerResponseData struct {
	Message string `json:"message"`
}

type AdminTestConnectionResponse struct {
	Success bool                            `json:"success"`
	Data    AdminTestConnectionResponseData `json:"data"`
}

type AdminTestConnectionResponseData struct {
	Message string `json:"message"`
}
