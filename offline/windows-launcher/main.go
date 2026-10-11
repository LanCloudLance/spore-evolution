package main

import (
	"bufio"
	"crypto/sha256"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"time"
)

const address = "127.0.0.1:49325"
const gameURL = "http://" + address + "/"
const healthPath = "/__spore_offline_health"
const htmlName = "胞子离线版.html"

func fingerprint(html []byte) string {
	return fmt.Sprintf("spore-offline-v1:%x", sha256.Sum256(html))
}

func gameHandler(html []byte) http.Handler {
	health := []byte(fingerprint(html))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		if r.Host != address {
			http.Error(w, "Use "+gameURL, http.StatusMisdirectedRequest)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body []byte
		switch r.URL.Path {
		case "/", "/index.html":
			body = html
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
		case healthPath:
			body = health
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		default:
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		if r.Method == http.MethodGet {
			_, _ = w.Write(body)
		}
	})
}

func sameRunningGame(html []byte) bool {
	// Ignore proxy environment variables: this request must stay on loopback.
	client := &http.Client{
		Timeout:       time.Second,
		Transport:     &http.Transport{Proxy: nil, DisableKeepAlives: true},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://" + address + healthPath)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 256))
	return err == nil && response.StatusCode == http.StatusOK && string(body) == fingerprint(html)
}

func fail(err error, noBrowser bool) {
	fmt.Fprintln(os.Stderr, "孢子离线版启动失败：", err)
	if !noBrowser {
		fmt.Fprintln(os.Stderr, "按回车关闭此窗口。")
		_, _ = bufio.NewReader(os.Stdin).ReadString('\n')
	}
	os.Exit(1)
}

func launchBrowser(noBrowser bool) {
	if noBrowser {
		return
	}
	if err := openBrowser(gameURL); err != nil {
		fmt.Println("未能自动打开浏览器。请在 Edge 或 Chrome 中打开：", gameURL)
	}
}

func main() {
	noBrowser := flag.Bool("no-browser", false, "Run without opening the default browser (for verification)")
	flag.Parse()
	executable, err := os.Executable()
	if err != nil {
		fail(err, *noBrowser)
	}
	html, err := os.ReadFile(filepath.Join(filepath.Dir(executable), htmlName))
	if err != nil {
		fail(fmt.Errorf("请完整解压游戏包，把启动器与 %s 放在同一文件夹。%w", htmlName, err), *noBrowser)
	}
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		if sameRunningGame(html) {
			fmt.Println("这一版本已经运行，正在打开游戏。")
			launchBrowser(*noBrowser)
			return
		}
		fail(fmt.Errorf("地址 %s 已被占用。请关闭旧游戏启动窗口再试。%w", address, err), *noBrowser)
	}
	defer listener.Close()
	server := &http.Server{
		Handler:           gameHandler(html),
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       5 * time.Second,
		MaxHeaderBytes:    16 * 1024,
	}
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	defer signal.Stop(interrupt)
	go func() {
		<-interrupt
		_ = server.Close()
	}()
	fmt.Println("孢子离线版已启动：", gameURL)
	fmt.Println("请保留这个窗口。结束前在游戏里保存，关闭此窗口或按 Ctrl+C 可结束启动器。")
	launchBrowser(*noBrowser)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		fail(err, *noBrowser)
	}
}
