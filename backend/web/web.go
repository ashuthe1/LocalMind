// Package web serves the built frontend (embedded at compile time or from a directory).
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"
)

//go:embed all:dist
var embedded embed.FS

const placeholder = `<!doctype html><html><head><meta charset="utf-8"><title>LocalMind</title>
<style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:grid;place-items:center;height:100vh;margin:0}
main{max-width:560px;padding:2rem;line-height:1.5}code{background:#222;padding:.15em .4em;border-radius:4px}</style></head>
<body><main><h1>LocalMind API is running</h1>
<p>The web UI has not been built into this binary yet. Either:</p>
<ul><li>run the dev server: <code>cd frontend && npm run dev</code> and open <a style="color:#8ab4f8" href="http://localhost:5173">http://localhost:5173</a>, or</li>
<li>build it once: <code>cd frontend && npm run build</code>, then restart the backend.</li></ul>
<p>API health: <a style="color:#8ab4f8" href="/api/health">/api/health</a></p></main></body></html>`

// Handler returns an http.Handler serving the SPA. dir overrides the embedded files when non-empty.
func Handler(dir string) http.Handler {
	var files fs.FS
	if dir != "" {
		files = os.DirFS(dir)
	} else {
		sub, err := fs.Sub(embedded, "dist")
		if err != nil {
			panic(err)
		}
		files = sub
	}
	fileServer := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if f, err := files.Open(p); err == nil {
			f.Close()
			if strings.HasSuffix(p, ".webmanifest") {
				w.Header().Set("Content-Type", "application/manifest+json")
			}
			if p == "index.html" || p == "sw.js" {
				w.Header().Set("Cache-Control", "no-cache")
			} else if strings.HasPrefix(p, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		// SPA fallback: unknown paths render index.html so client-side routes work.
		if f, err := files.Open("index.html"); err == nil {
			f.Close()
			w.Header().Set("Cache-Control", "no-cache")
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(placeholder))
	})
}
