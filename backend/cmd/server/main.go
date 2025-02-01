package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/ashuthe1/localmind/api"
	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/logger"
	"github.com/ashuthe1/localmind/repository"
	"github.com/ashuthe1/localmind/services"
)

func main() {
	// Initialize Logger
	logger.InitLogger()
	logger.Log.Info("Logger initialized successfully")

	cfg := config.LoadConfig()

	// Connect to MongoDB
	mongoClient, err := config.ConnectMongoDB(cfg.MongoURI)
	if err != nil {
		logger.Log.Errorf("Failed to connect to MongoDB: %v", err)
		os.Exit(1)
	}
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			logger.Log.Errorf("Failed to disconnect MongoDB: %v", err)
		}
	}()

	db := mongoClient.Database(cfg.DatabaseName)
	chatRepo := repository.NewChatRepository(db)
	userRepo := repository.NewUserRepository(db)
	chatService := services.NewChatService(chatRepo)
	ollamaService := services.NewOllamaService()
	userService := services.NewUserService(userRepo)
	handler := api.NewHandler(chatService, ollamaService, userService)
	router := api.SetupRoutes(handler)

	srv := &http.Server{
		Addr:         cfg.ServerAddress,
		WriteTimeout: 10 * time.Minute,
		ReadTimeout:  10 * time.Minute,
		IdleTimeout:  10 * time.Minute,
		Handler:      router,
	}

	// Start Server
	go func() {
		logger.Log.Infof("Server is running on %s", cfg.ServerAddress)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful Shutdown
	waitForShutdown(srv)
}

func waitForShutdown(srv *http.Server) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	logger.Log.Warn("Server is shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Log.Errorf("Server forced to shutdown: %v", err)
	}

	logger.Log.Info("Server exited gracefully")
}
