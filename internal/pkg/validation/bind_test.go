package validation

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

type sampleReq struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

func (s *sampleReq) Validate() error {
	if s.Name == "" {
		return errMissingName
	}
	if s.Count < 0 {
		return errNegativeCount
	}
	return nil
}

var (
	errMissingName   = &validationError{msg: "name is required"}
	errNegativeCount = &validationError{msg: "count must be non-negative"}
)

type validationError struct{ msg string }

func (v *validationError) Error() string { return v.msg }

func newJSONCtx(t *testing.T, body string) (echo.Context, *httptest.ResponseRecorder) {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func TestBindRequest_decodesJSONBody(t *testing.T) {
	c, _ := newJSONCtx(t, `{"name":"alpha","count":3}`)

	var req sampleReq
	if err := BindRequest(c, &req); err != nil {
		t.Fatalf("BindRequest: %v", err)
	}
	if req.Name != "alpha" || req.Count != 3 {
		t.Errorf("decoded payload mismatch: %+v", req)
	}
}

func TestBindRequest_returns400OnMalformedJSON(t *testing.T) {
	c, _ := newJSONCtx(t, `{"name":`)

	var req sampleReq
	err := BindRequest(c, &req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	httpErr, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("error type: got %T, want *echo.HTTPError", err)
	}
	if httpErr.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", httpErr.Code)
	}
}

func TestBindAndValidate_decodesAndPassesValidation(t *testing.T) {
	c, _ := newJSONCtx(t, `{"name":"alpha","count":3}`)

	var req sampleReq
	if err := BindAndValidate(c, &req); err != nil {
		t.Fatalf("BindAndValidate: %v", err)
	}
	if req.Name != "alpha" || req.Count != 3 {
		t.Errorf("decoded payload not propagated to caller: %+v", req)
	}
}

func TestBindAndValidate_returns400WhenValidateFails(t *testing.T) {
	c, _ := newJSONCtx(t, `{"name":"","count":3}`)

	var req sampleReq
	err := BindAndValidate(c, &req)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	httpErr, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("error type: got %T, want *echo.HTTPError", err)
	}
	if httpErr.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", httpErr.Code)
	}
	if msg, _ := httpErr.Message.(string); msg != errMissingName.Error() {
		t.Errorf("message: got %q, want %q", msg, errMissingName.Error())
	}
}

func TestBindAndValidate_returns400OnMalformedJSON(t *testing.T) {
	c, _ := newJSONCtx(t, `{`)

	var req sampleReq
	err := BindAndValidate(c, &req)
	if err == nil {
		t.Fatal("expected bind error, got nil")
	}
	httpErr, ok := err.(*echo.HTTPError)
	if !ok {
		t.Fatalf("error type: got %T, want *echo.HTTPError", err)
	}
	if httpErr.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", httpErr.Code)
	}
}

func TestBindAndValidate_preservesValidateErrorForUnwrap(t *testing.T) {
	c, _ := newJSONCtx(t, `{"name":"","count":3}`)

	var req sampleReq
	err := BindAndValidate(c, &req)
	if err == nil {
		t.Fatal("expected validation error, got nil")
	}
	if !errors.Is(err, errMissingName) {
		t.Errorf("errors.Is(err, errMissingName) = false; want true so handlers can route on the named error")
	}
}

func TestErrorMessage_extractsHTTPErrorString(t *testing.T) {
	err := echo.NewHTTPError(http.StatusBadRequest, "name is required")
	if got := ErrorMessage(err); got != "name is required" {
		t.Errorf("ErrorMessage() = %q, want %q", got, "name is required")
	}
}

func TestErrorMessage_fallsBackToErrErrorForPlainError(t *testing.T) {
	err := errMissingName
	if got := ErrorMessage(err); got != "name is required" {
		t.Errorf("ErrorMessage() = %q, want %q", got, "name is required")
	}
}

func TestErrorMessage_returnsEmptyForNil(t *testing.T) {
	if got := ErrorMessage(nil); got != "" {
		t.Errorf("ErrorMessage(nil) = %q, want %q", got, "")
	}
}

func TestErrorMessage_fallsBackForNonStringHTTPMessage(t *testing.T) {
	err := echo.NewHTTPError(http.StatusBadRequest, map[string]string{"field": "name"})
	got := ErrorMessage(err)
	if got == "" {
		t.Errorf("ErrorMessage() returned empty string for non-string HTTPError message")
	}
}
