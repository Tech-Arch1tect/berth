package harness

import (
	"github.com/stretchr/testify/mock"
)

type MockMailService struct {
	mock.Mock
}

func (m *MockMailService) SendTemplate(templateName string, to []string, subject string, data map[string]any) error {
	args := m.Called(templateName, to, subject, data)
	return args.Error(0)
}
