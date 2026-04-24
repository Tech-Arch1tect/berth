package server

type AdminListServersResponse struct {
	Success bool                         `json:"success"`
	Data    AdminListServersResponseData `json:"data"`
}

type AdminListServersResponseData struct {
	Servers []ServerInfo `json:"servers"`
}

type AdminCreateServerRequest = ServerCreateRequest

type AdminCreateServerResponse struct {
	Success bool                          `json:"success"`
	Data    AdminCreateServerResponseData `json:"data"`
}

type AdminCreateServerResponseData struct {
	Server ServerInfo `json:"server"`
}

type AdminUpdateServerRequest = ServerUpdateRequest

type AdminUpdateServerResponse struct {
	Success bool                          `json:"success"`
	Data    AdminUpdateServerResponseData `json:"data"`
}

type AdminUpdateServerResponseData struct {
	Server ServerInfo `json:"server"`
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
