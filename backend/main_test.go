package main

import (
	"errors"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRunDefaultsPortAndServesStaticAndAPI(t *testing.T) {
	var addr string
	err := run("", func(got string, handler http.Handler) error {
		addr = got
		page := httptest.NewRecorder()
		handler.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/", nil))
		if page.Code != http.StatusOK {
			t.Fatalf("index status = %d", page.Code)
		}
		body, _ := io.ReadAll(page.Body)
		if !strings.Contains(string(body), "sezzle") {
			t.Fatalf("index body = %q", body)
		}

		asset := httptest.NewRecorder()
		handler.ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/missing", nil))
		if asset.Code != http.StatusNotFound {
			t.Fatalf("missing status = %d", asset.Code)
		}

		api := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/calculate", strings.NewReader(`{"operation":"sqrt","a":-9,"b":1}`))
		handler.ServeHTTP(api, req)
		if api.Code != http.StatusBadRequest {
			t.Fatalf("api status = %d body=%s", api.Code, api.Body.String())
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if addr != ":8081" {
		t.Fatalf("addr = %s", addr)
	}
}

func TestRunUsesPortAndReturnsListenError(t *testing.T) {
	err := run("3000", func(addr string, _ http.Handler) error {
		if addr != ":3000" {
			t.Fatalf("addr = %s", addr)
		}
		return errors.New("bind")
	})
	if err == nil || err.Error() != "bind" {
		t.Fatalf("err = %v", err)
	}
}

func TestRunMissingStatic(t *testing.T) {
	orig := sub
	sub = func(fs.FS, string) (fs.FS, error) {
		return nil, errors.New("no static")
	}
	t.Cleanup(func() { sub = orig })

	err := run("1", func(string, http.Handler) error {
		t.Fatal("listen should not be called")
		return nil
	})
	if err == nil || err.Error() != "no static" {
		t.Fatalf("err = %v", err)
	}
}

func TestMainExitCodes(t *testing.T) {
	origListen, origExit := listen, exit
	t.Cleanup(func() {
		listen = origListen
		exit = origExit
	})

	t.Run("success", func(t *testing.T) {
		var code int
		listen = func(addr string, handler http.Handler) error {
			if addr != ":9091" || handler == nil {
				t.Fatalf("addr=%s handler=%v", addr, handler)
			}
			return nil
		}
		exit = func(c int) { code = c }
		t.Setenv("PORT", "9091")
		main()
		if code != 0 {
			t.Fatalf("code = %d", code)
		}
	})

	t.Run("failure", func(t *testing.T) {
		var code int
		listen = func(string, http.Handler) error { return errors.New("bind") }
		exit = func(c int) { code = c }
		t.Setenv("PORT", "9092")
		main()
		if code != 1 {
			t.Fatalf("code = %d", code)
		}
	})
}

func TestExitCode(t *testing.T) {
	if exitCode(nil) != 0 {
		t.Fatal("nil error should exit 0")
	}
	if exitCode(errors.New("down")) != 1 {
		t.Fatal("listen error should exit 1")
	}
}
