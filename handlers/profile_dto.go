package handlers

import "berth/internal/dto"

type GetProfileResponse struct {
	Success bool         `json:"success"`
	Data    dto.UserInfo `json:"data"`
}
