// cmd/server/main.go

package main

import (
	"github.com/ashuthe1/localmind/api"
	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/repository"
	"github.com/ashuthe1/localmind/services"
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Connect to MongoDB
	mongoClient, err := config.ConnectMongoDB(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer func() {
		if err := mongoClient.Disconnect(context.Background()); err != nil {
			log.Fatalf("Failed to disconnect MongoDB: %v", err)
		}
	}()

	// Initialize Repositories
	db := mongoClient.Database(cfg.DatabaseName)
	chatRepo := repository.NewChatRepository(db)

	// Initialize Services
	chatService := services.NewChatService(chatRepo)
	ollamaService := services.NewOllamaService()

	// Initialize Handlers
	handler := api.NewHandler(chatService, ollamaService)

	// Setup Routes
	router := api.SetupRoutes(handler)

	// Create HTTP Server
	srv := &http.Server{
		Addr:         cfg.ServerAddress,
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
		Handler:      router,
	}

	// Start Server in a Goroutine
	go func() {
		log.Printf("Server is running on %s", cfg.ServerAddress)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Graceful Shutdown
	waitForShutdown(srv)
}

// waitForShutdown handles graceful server shutdown on interrupt signals.
func waitForShutdown(srv *http.Server) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit

	log.Println("Server is shutting down...")

	// Create a deadline to wait for current operations to finish
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}