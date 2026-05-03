package harness

import "berth/internal/app/apptest"

type (
	SentMail             = apptest.SentMail
	CapturingMailService = apptest.CapturingMailService
)

var NewCapturingMailService = apptest.NewCapturingMailService
