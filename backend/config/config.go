// config/config.go

package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var ModelName string
var UserName string
var UserId string

// Config holds the configuration values.
type Config struct {
	ServerAddress string
	MongoURI      string
	DatabaseName  string
	ModelName     string
	UserName      string
}

func LoadConfig() *Config {
	curDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get current directory: %v", err)
	}

	envFilePath := filepath.Join(filepath.Dir(curDir), ".env")

	err = godotenv.Load(envFilePath)
	if err != nil {
		log.Println("No .env file found or failed to load it. Continuing without environment variables or defaults.")
		log.Println("Expecting .env file in this path: ", envFilePath)
	}

	ModelName = getEnv("MODEL_NAME", "deepseek-r1:8b")
	UserName = getEnv("USERNAME", "ashuthe1")

	return &Config{
		ServerAddress: getEnv("SERVER_ADDRESS", ":8080"),
		MongoURI:      getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DatabaseName:  getEnv("DATABASE_NAME", "LocalMind"),
		ModelName:     getEnv("MODEL_NAME", "deepseek-r1:8b"),
		UserName:      getEnv("USERNAME", "ashuthe1"),
	}
}

// getEnv fetches the value of an environment variable or returns a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ConnectMongoDB establishes a connection to the MongoDB database.
func ConnectMongoDB(uri string) (*mongo.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, err
	}

	// Ping the database to verify the connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, err
	}

	fmt.Println("Connected to MongoDB!")
	return client, nil
}
