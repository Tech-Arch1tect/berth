package server

type AdminCreateServerRequest = ServerCreateRequest

type AdminUpdateServerRequest = ServerUpdateRequest

type AdminListServersData struct {
	Servers []ServerInfo `json:"servers"`
}

type GetServerData struct {
	Server ServerInfo `json:"server"`
}

type AdminCreateServerData struct {
	Server ServerInfo `json:"server"`
}

type AdminUpdateServerData struct {
	Server ServerInfo `json:"server"`
}

type MessageData struct {
	Message string `json:"message"`
}
