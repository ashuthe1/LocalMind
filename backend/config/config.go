// Package config loads environment configuration.
package config

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Version is the LocalMind release version.
const Version = "2.0.0"

// Config holds all runtime configuration.
type Config struct {
	ServerAddress string
	Storage       string // sqlite | mongo
	DataDir       string
	SQLitePath    string
	MongoURI      string
	DatabaseName  string
	FrontendDir   string // serve a built frontend from this directory instead of the embedded one
	CORSOrigins   []string
	LogLevel      string
	RootDir       string // repository root (where .env lives)

	// First-run bootstrap (used only when no provider is configured yet).
	UserName        string
	DefaultProvider string // provider type: ollama | openai | anthropic | gemini | lmstudio
	DefaultBaseURL  string
	DefaultAPIKey   string
	DefaultModel    string
	OpenBrowser     bool
}

// Load reads .env (from the working directory or its parent) and the environment.
func Load() *Config {
	cwd, _ := os.Getwd()
	root := cwd
	for _, candidate := range []string{filepath.Join(cwd, ".env"), filepath.Join(filepath.Dir(cwd), ".env")} {
		if _, err := os.Stat(candidate); err == nil {
			_ = godotenv.Load(candidate)
			root = filepath.Dir(candidate)
			break
		}
	}
	if filepath.Base(cwd) == "backend" {
		root = filepath.Dir(cwd)
	}

	cfg := &Config{
		ServerAddress:   getEnv("SERVER_ADDRESS", ":8080"),
		Storage:         strings.ToLower(getEnv("STORAGE", "")),
		DataDir:         getEnv("DATA_DIR", filepath.Join(root, "data")),
		MongoURI:        getEnv("MONGO_URI", ""),
		DatabaseName:    getEnv("DATABASE_NAME", "LocalMind"),
		FrontendDir:     getEnv("FRONTEND_DIR", ""),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		RootDir:         root,
		UserName:        getEnv("USER_NAME", getEnv("LOCALMIND_USERNAME", "friend")),
		DefaultProvider: strings.ToLower(getEnv("DEFAULT_PROVIDER", "")),
		DefaultBaseURL:  getEnv("DEFAULT_PROVIDER_URL", getEnv("OLLAMA_URL", "")),
		DefaultAPIKey:   getEnv("DEFAULT_PROVIDER_KEY", ""),
		DefaultModel:    getEnv("MODEL_NAME", ""),
		OpenBrowser:     getEnvBool("OPEN_BROWSER", false),
	}
	if cfg.Storage == "" {
		if cfg.MongoURI != "" {
			cfg.Storage = "mongo"
		} else {
			cfg.Storage = "sqlite"
		}
	}
	if cfg.MongoURI == "" {
		cfg.MongoURI = "mongodb://localhost:27017"
	}
	cfg.SQLitePath = getEnv("SQLITE_PATH", filepath.Join(cfg.DataDir, "localmind.db"))
	if cfg.DefaultProvider == "" {
		cfg.DefaultProvider = "ollama"
	}
	if origins := getEnv("CORS_ORIGINS", ""); origins != "" {
		for _, o := range strings.Split(origins, ",") {
			if o = strings.TrimSpace(o); o != "" {
				cfg.CORSOrigins = append(cfg.CORSOrigins, o)
			}
		}
	}
	return cfg
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}
