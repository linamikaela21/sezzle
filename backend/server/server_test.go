package server

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCalculateEndpoint(t *testing.T) {
	handler := NewHandler()

	t.Run("add", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"add","a":200,"b":20}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Result float64 `json:"result"`
		}
		decode(t, rec, &body)
		if body.Result != 220 {
			t.Fatalf("result = %v, want 220", body.Result)
		}
	})

	t.Run("sqrt ignores b", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"sqrt","a":9,"b":5}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Result float64 `json:"result"`
		}
		decode(t, rec, &body)
		if body.Result != 3 {
			t.Fatalf("result = %v, want 3", body.Result)
		}
	})

	t.Run("percent", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"percent","a":50,"b":0}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Result float64 `json:"result"`
		}
		decode(t, rec, &body)
		if body.Result != 0.5 {
			t.Fatalf("result = %v, want 0.5", body.Result)
		}
	})

	t.Run("division by zero", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"div","a":1,"b":0}`)
		assertError(t, rec, http.StatusBadRequest, "division by zero")
	})

	t.Run("negative sqrt", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"sqrt","a":-1,"b":0}`)
		assertError(t, rec, http.StatusBadRequest, "square root of negative number")
	})

	t.Run("unknown operation", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"mod","a":1,"b":1}`)
		assertError(t, rec, http.StatusBadRequest, "unknown operation")
	})

	t.Run("invalid json", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":`)
		assertError(t, rec, http.StatusBadRequest, "invalid request")
	})

	t.Run("method not allowed", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/calculate", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		assertError(t, rec, http.StatusMethodNotAllowed, "method not allowed")
	})

	t.Run("empty body", func(t *testing.T) {
		rec := postJSON(t, handler, "")
		assertError(t, rec, http.StatusBadRequest, "invalid request")
	})

	t.Run("non finite", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"mul","a":1.7976931348623157e+308,"b":2}`)
		assertError(t, rec, http.StatusBadRequest, "non-finite result")
	})

	t.Run("exp and sub", func(t *testing.T) {
		exp := postJSON(t, handler, `{"operation":"exp","a":2,"b":3}`)
		var body struct {
			Result float64 `json:"result"`
		}
		decode(t, exp, &body)
		if exp.Code != http.StatusOK || body.Result != 8 {
			t.Fatalf("exp status=%d result=%v", exp.Code, body.Result)
		}
		sub := postJSON(t, handler, `{"operation":"sub","a":1,"b":4}`)
		decode(t, sub, &body)
		if sub.Code != http.StatusOK || body.Result != -3 {
			t.Fatalf("sub status=%d result=%v", sub.Code, body.Result)
		}
	})

	t.Run("numeric field with wrong type", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"add","a":"x","b":1}`)
		assertError(t, rec, http.StatusBadRequest, invalidRequestMessage)
	})

	t.Run("rejects payloads that break the contract", func(t *testing.T) {
		cases := []string{
			`{"operation":"add","a":1}`,
			`{"operation":"add","a":null,"b":1}`,
			`{"operation":"add","a":1,"b":2,"extra":true}`,
			`{"operation":1,"a":1,"b":2}`,
			`{"operation":"add","a":true,"b":2}`,
			`{"operation":"add","a":1,"b":null}`,
			`{"operation":"add","a":1,"b":2}{"operation":"add","a":1,"b":1}`,
			`null`,
			`{"operation":"add","a":1e309,"b":1}`,
		}
		for _, body := range cases {
			rec := postJSON(t, handler, body)
			assertError(t, rec, http.StatusBadRequest, invalidRequestMessage)
		}
	})

	t.Run("negative numbers stay numbers", func(t *testing.T) {
		rec := postJSON(t, handler, `{"operation":"sub","a":-1,"b":-2}`)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
		}
		var body struct {
			Result float64 `json:"result"`
		}
		decode(t, rec, &body)
		if body.Result != 1 {
			t.Fatalf("result = %v, want 1", body.Result)
		}
	})

	t.Run("body too large", func(t *testing.T) {
		rec := postJSON(t, handler, strings.Repeat("a", maxRequestBytes+1))
		assertError(t, rec, http.StatusBadRequest, invalidRequestMessage)
	})

	t.Run("cors preflight", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/calculate", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
			t.Fatalf("allow origin = %q", got)
		}
	})
}

func TestAPIRemainsRoutedWithStatic(t *testing.T) {
	static := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "static", http.StatusTeapot)
	})
	rec := postJSON(t, NewHandlerWithStatic(static), `{"operation":"add","a":1,"b":2}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestWriteDomainErrorHidesUnknown(t *testing.T) {
	rec := httptest.NewRecorder()
	writeDomainError(rec, errors.New("db password"))
	assertError(t, rec, http.StatusBadRequest, invalidRequestMessage)
}

func TestJSONFieldParsers(t *testing.T) {
	if _, err := parseJSONString(json.RawMessage(`"add"`)); err != nil {
		t.Fatal(err)
	}
	if _, err := parseJSONString(nil); err == nil {
		t.Fatal("empty operation should fail")
	}
	if _, err := parseJSONString(json.RawMessage("1")); err == nil {
		t.Fatal("numeric operation should fail")
	}
	if _, err := parseJSONString(json.RawMessage(`"\q"`)); err == nil {
		t.Fatal("broken string should fail")
	}

	if _, err := parseJSONFloat(json.RawMessage(" -2.5 ")); err != nil {
		t.Fatal(err)
	}
	if _, err := parseJSONFloat(nil); err == nil {
		t.Fatal("empty number should fail")
	}
	if _, err := parseJSONFloat(json.RawMessage("null")); err == nil {
		t.Fatal("null number should fail")
	}
	if _, err := parseJSONFloat(json.RawMessage("1e309")); err == nil {
		t.Fatal("overflow should fail")
	}
	if isJSONNumber(nil) {
		t.Fatal("empty raw is not a number")
	}
}

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	NewHandler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}

	post := httptest.NewRequest(http.MethodPost, "/health", nil)
	rec = httptest.NewRecorder()
	NewHandler().ServeHTTP(rec, post)
	assertError(t, rec, http.StatusMethodNotAllowed, "method not allowed")
}

func TestStaticFiles(t *testing.T) {
	static := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "app")
	})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	NewHandlerWithStatic(static).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if strings.TrimSpace(rec.Body.String()) != "app" {
		t.Fatalf("body = %q", rec.Body.String())
	}
}

func postJSON(t *testing.T, handler http.Handler, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/calculate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, dest any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), dest); err != nil {
		t.Fatalf("decode: %v body=%s", err, rec.Body.String())
	}
}

func assertError(t *testing.T, rec *httptest.ResponseRecorder, status int, message string) {
	t.Helper()
	if rec.Code != status {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, status, rec.Body.String())
	}
	var body struct {
		Error string `json:"error"`
	}
	decode(t, rec, &body)
	if body.Error != message {
		t.Fatalf("error = %q, want %q", body.Error, message)
	}
}
