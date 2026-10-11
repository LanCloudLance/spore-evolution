package main

import (
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestGameHandler(t *testing.T) {
	html := []byte("<!doctype html><title>孢子离线测试</title>")
	tests := []struct {
		name, method, path, host string
		status                   int
		body                     string
	}{
		{"game", "GET", "/", address, 200, string(html)},
		{"index", "GET", "/index.html", address, 200, string(html)},
		{"query", "GET", "/?play=1", address, 200, string(html)},
		{"head", "HEAD", "/", address, 200, ""},
		{"health", "GET", healthPath, address, 200, fingerprint(html)},
		{"health head", "HEAD", healthPath, address, 200, ""},
		{"unrelated file", "GET", "/使用说明.txt", address, 404, ""},
		{"traversal", "GET", "/../private-file", address, 404, ""},
		{"escaped traversal", "GET", "/%2e%2e/private-file", address, 404, ""},
		{"post", "POST", "/", address, 405, ""},
		{"wrong host", "GET", "/", "example.com:49325", 421, ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest(test.method, "http://"+test.host+test.path, nil)
			w := httptest.NewRecorder()
			gameHandler(html).ServeHTTP(w, r)
			if w.Code != test.status {
				t.Fatalf("status: got %d, want %d", w.Code, test.status)
			}
			if test.status == 200 && w.Body.String() != test.body {
				t.Fatalf("unexpected response body")
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("game must not be cached across releases")
			}
			if test.status == 200 && test.path == "/" && w.Header().Get("Content-Length") != strconv.Itoa(len(html)) {
				t.Fatal("Content-Length must count UTF-8 bytes")
			}
			if test.status == 405 && w.Header().Get("Allow") != "GET, HEAD" {
				t.Fatal("missing allowed methods")
			}
			if test.status == 200 && test.path == "/" && w.Header().Get("Content-Type") != "text/html; charset=utf-8" {
				t.Fatal("missing UTF-8 content type")
			}
		})
	}
}

func TestFingerprintIdentifiesTheExactGame(t *testing.T) {
	if fingerprint([]byte("version 1")) == fingerprint([]byte("version 2")) {
		t.Fatal("different releases must not reuse an old server")
	}
}
