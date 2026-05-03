package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func newCtx() (echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v\nraw: %s", err, rec.Body.String())
	}
	return body
}

func TestOK_emitsSuccessEnvelope(t *testing.T) {
	c, rec := newCtx()
	type payload struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	if err := OK(c, payload{ID: 7, Name: "alpha"}); err != nil {
		t.Fatalf("OK returned error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}

	body := decode(t, rec)
	if body["success"] != true {
		t.Errorf("success: got %v, want true", body["success"])
	}
	if _, ok := body["error"]; ok {
		t.Errorf("error key should be omitted on success")
	}
	if _, ok := body["meta"]; ok {
		t.Errorf("meta key should be omitted when nil")
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("data: got %T, want object", body["data"])
	}
	if data["id"] != float64(7) || data["name"] != "alpha" {
		t.Errorf("data payload mismatch: %v", data)
	}
}

func TestCreated_status201(t *testing.T) {
	c, rec := newCtx()
	if err := Created(c, map[string]string{"name": "x"}); err != nil {
		t.Fatalf("Created returned error: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Errorf("status: got %d, want 201", rec.Code)
	}
}

func TestPaginated_includesMeta(t *testing.T) {
	c, rec := newCtx()
	page, size, total := 2, 10, 47
	meta := Meta{Page: &page, PageSize: &size, TotalCount: &total}

	if err := Paginated(c, []int{1, 2, 3}, meta); err != nil {
		t.Fatalf("Paginated returned error: %v", err)
	}

	body := decode(t, rec)
	m, ok := body["meta"].(map[string]any)
	if !ok {
		t.Fatalf("meta: got %T, want object", body["meta"])
	}
	if m["page"] != float64(2) || m["pageSize"] != float64(10) || m["totalCount"] != float64(47) {
		t.Errorf("meta payload mismatch: %v", m)
	}
	if _, ok := m["requestId"]; ok {
		t.Errorf("requestId should be omitted when empty")
	}
}

func TestErr_emitsErrorEnvelope(t *testing.T) {
	c, rec := newCtx()
	if err := Err(c, http.StatusNotFound, CodeNotFound, "user not found"); err != nil {
		t.Fatalf("Err returned error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("status: got %d, want 404", rec.Code)
	}

	body := decode(t, rec)
	if body["success"] != false {
		t.Errorf("success: got %v, want false", body["success"])
	}
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error: got %T, want object", body["error"])
	}
	if errObj["code"] != "not_found" || errObj["message"] != "user not found" {
		t.Errorf("error payload mismatch: %v", errObj)
	}
	if _, ok := errObj["details"]; ok {
		t.Errorf("details should be omitted when nil")
	}
	data, ok := body["data"].(map[string]any)
	if !ok || len(data) != 0 {
		t.Errorf("data: got %v, want {}", body["data"])
	}
}

func TestErrWithDetails_includesDetails(t *testing.T) {
	c, rec := newCtx()
	details := map[string]string{"username": "required", "email": "invalid"}

	if err := ErrWithDetails(c, http.StatusBadRequest, CodeValidationFailed, "validation failed", details); err != nil {
		t.Fatalf("ErrWithDetails returned error: %v", err)
	}

	body := decode(t, rec)
	errObj := body["error"].(map[string]any)
	got := errObj["details"].(map[string]any)
	if got["username"] != "required" || got["email"] != "invalid" {
		t.Errorf("details mismatch: %v", got)
	}
}

func TestConvenienceHelpers_setStatusAndCode(t *testing.T) {
	cases := []struct {
		name     string
		fn       func(echo.Context, string) error
		wantCode int
		wantErr  string
	}{
		{"BadRequest", BadRequest, http.StatusBadRequest, CodeBadRequest},
		{"Unauthorized", Unauthorized, http.StatusUnauthorized, CodeUnauthorized},
		{"Forbidden", Forbidden, http.StatusForbidden, CodeForbidden},
		{"NotFound", NotFound, http.StatusNotFound, CodeNotFound},
		{"Conflict", Conflict, http.StatusConflict, CodeConflict},
		{"UnprocessableEntity", UnprocessableEntity, http.StatusUnprocessableEntity, CodeUnprocessableEntity},
		{"TooManyRequests", TooManyRequests, http.StatusTooManyRequests, CodeTooManyRequests},
		{"Internal", Internal, http.StatusInternalServerError, CodeInternal},
		{"BadGateway", BadGateway, http.StatusBadGateway, CodeBadGateway},
		{"ServiceUnavailable", ServiceUnavailable, http.StatusServiceUnavailable, CodeServiceUnavailable},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, rec := newCtx()
			if err := tc.fn(c, "msg"); err != nil {
				t.Fatalf("returned error: %v", err)
			}
			if rec.Code != tc.wantCode {
				t.Errorf("status: got %d, want %d", rec.Code, tc.wantCode)
			}
			body := decode(t, rec)
			errObj := body["error"].(map[string]any)
			if errObj["code"] != tc.wantErr {
				t.Errorf("code: got %v, want %s", errObj["code"], tc.wantErr)
			}
			if errObj["message"] != "msg" {
				t.Errorf("message: got %v, want msg", errObj["message"])
			}
		})
	}
}

func TestValidation_usesBadRequestStatusAndValidationCode(t *testing.T) {
	c, rec := newCtx()
	if err := Validation(c, "bad input", map[string]string{"x": "required"}); err != nil {
		t.Fatalf("Validation returned error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status: got %d, want 400", rec.Code)
	}
	body := decode(t, rec)
	errObj := body["error"].(map[string]any)
	if errObj["code"] != CodeValidationFailed {
		t.Errorf("code: got %v, want %s", errObj["code"], CodeValidationFailed)
	}
}

func TestResponse_dataAlwaysPresentOnSuccess(t *testing.T) {
	c, rec := newCtx()
	if err := OK(c, struct{}{}); err != nil {
		t.Fatalf("OK returned error: %v", err)
	}
	body := decode(t, rec)
	if _, ok := body["data"]; !ok {
		t.Errorf("data key must always be present on success, got: %v", body)
	}
}
