// Package serve implements the static SPA file server used to deploy the
// built bundlestate frontend. It serves the compiled assets from a dist
// directory and falls back to index.html for any unknown route so client-side
// routing works (catch-all SPA behavior), exactly like the nginx config it
// replaces. It also exposes a /healthz endpoint for container probes.
package serve

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Config controls the server.
type Config struct {
	// Addr is the listen address, e.g. ":80".
	Addr string
	// Dir is the path to the built SPA (dist/).
	Dir string
	// Healthy, when false, makes /healthz return 503 (for draining).
	Healthy bool
}

// Handler builds the http.Handler that serves the SPA with a catch-all
// fallback to index.html.
func Handler(cfg Config) (http.Handler, error) {
	fileServer := http.FileServer(http.Dir(cfg.Dir))

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if cfg.Healthy {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("unhealthy"))
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Try the file first; on miss, serve index.html (SPA fallback).
		clean := strings.TrimPrefix(r.URL.Path, "/")
		if clean != "" {
			if info, err := os.Stat(filepath.Join(cfg.Dir, clean)); err == nil && !info.IsDir() {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		// fallback
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
	return mux, nil
}

// Run starts the server and blocks until it exits (or fails to listen).
func Run(cfg Config) error {
	h, err := Handler(cfg)
	if err != nil {
		return err
	}
	log.Printf("bundlestate: serving SPA from %s on %s", cfg.Dir, cfg.Addr)
	return http.ListenAndServe(cfg.Addr, h)
}
