// Command server runs the LocalMind backend (API + embedded web UI).
package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/ashuthe1/localmind/api"
	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/logger"
	"github.com/ashuthe1/localmind/services"
	"github.com/ashuthe1/localmind/store"
	mongostore "github.com/ashuthe1/localmind/store/mongo"
	sqlitestore "github.com/ashuthe1/localmind/store/sqlite"
	"github.com/ashuthe1/localmind/web"
)

func main() {
	cfg := config.Load()
	logger.Init(filepath.Join(cfg.DataDir, "logs"), cfg.LogLevel)
	logger.Log.Infof("LocalMind %s starting (storage=%s)", config.Version, cfg.Storage)

	st, err := openStore(cfg)
	if err != nil {
		logger.Log.Fatalf("Could not open storage: %v", err)
	}
	defer st.Close()

	settingsSvc := services.NewSettingsService(st)
	if err := settingsSvc.Bootstrap(context.Background(), cfg); err != nil {
		logger.Log.Fatalf("Could not initialize settings: %v", err)
	}
	providerSvc := services.NewProviderService(settingsSvc)
	chatSvc := services.NewChatService(st, settingsSvc, providerSvc)
	handler := api.NewHandler(chatSvc, settingsSvc, providerSvc, st.Name())
	router := api.SetupRoutes(handler, web.Handler(cfg.FrontendDir), cfg.CORSOrigins)

	srv := &http.Server{
		Addr:              cfg.ServerAddress,
		Handler:           router,
		ReadHeaderTimeout: 30 * time.Second,
		IdleTimeout:       5 * time.Minute,
		// No WriteTimeout: responses stream for as long as the model generates.
	}

	go func() {
		url := displayURL(cfg.ServerAddress)
		fmt.Printf("\n  LocalMind is running at %s\n  Storage: %s\n\n", url, describeStorage(cfg))
		if cfg.OpenBrowser {
			openBrowser(url)
		}
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	logger.Log.Info("Shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Log.Errorf("Forced shutdown: %v", err)
	}
	logger.Log.Info("Bye")
}

func openStore(cfg *config.Config) (store.Store, error) {
	switch cfg.Storage {
	case "mongo", "mongodb":
		return mongostore.Open(context.Background(), cfg.MongoURI, cfg.DatabaseName)
	case "sqlite", "":
		return sqlitestore.Open(cfg.SQLitePath)
	default:
		return nil, fmt.Errorf("unknown STORAGE %q (use sqlite or mongo)", cfg.Storage)
	}
}

func describeStorage(cfg *config.Config) string {
	if cfg.Storage == "mongo" || cfg.Storage == "mongodb" {
		return "MongoDB (" + cfg.DatabaseName + ")"
	}
	return "SQLite (" + cfg.SQLitePath + ")"
}

func displayURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "http://localhost" + addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "localhost"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil && !strings.Contains(err.Error(), "not found") {
		logger.Log.Debugf("could not open browser: %v", err)
	}
}
