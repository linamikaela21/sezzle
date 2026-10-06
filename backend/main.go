package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"sezzle/backend/server"
)

//go:embed all:static
var embedded embed.FS

const defaultPort = "8081"

var (
	files  fs.FS = embedded
	listen       = http.ListenAndServe
	exit         = os.Exit
	sub          = fs.Sub
)

func main() {
	exit(exitCode(run(os.Getenv("PORT"), listen)))
}

func run(port string, listen func(string, http.Handler) error) error {
	static, err := sub(files, "static")
	if err != nil {
		return err
	}
	if port == "" {
		port = defaultPort
	}
	addr := ":" + port
	log.Printf("sezzle listening on %s", addr)
	return listen(addr, server.NewHandlerWithStatic(http.FileServer(http.FS(static))))
}

func exitCode(err error) int {
	if err == nil {
		return 0
	}
	log.Print(err)
	return 1
}
