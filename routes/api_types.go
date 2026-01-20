package routes

type ErrorResponse struct {
	Error string `json:"error"`
	Code  int    `json:"code"`
}
