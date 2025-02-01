// repository/user_repository.go
package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ashuthe1/localmind/config"
	"github.com/ashuthe1/localmind/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type UserRepository struct {
	collection *mongo.Collection
}

func NewUserRepository(db *mongo.Database) *UserRepository {
	return &UserRepository{
		collection: db.Collection("users"),
	}
}

// GetUserByID retrieves a user by its ID.
func (r *UserRepository) GetUserByID(id primitive.ObjectID) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername retrieves a user by its ID.
func (r *UserRepository) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(context.Background(), bson.M{"username": username}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates the user's settings.
// In this example, we update only the AboutMe and Preferences fields.
func (r *UserRepository) UpdateUser(user *models.User) error {
	user.UpdatedAt = time.Now()
	filter := bson.M{"username": config.UserName}
	update := bson.M{
		"$set": bson.M{
			"aboutMe":     user.AboutMe,
			"preferences": user.Preferences,
			"updatedAt":   user.UpdatedAt,
		},
	}
	_, err := r.collection.UpdateOne(context.Background(), filter, update)
	return err
}

// CreateUser creates a new user (if needed).
func (r *UserRepository) CreateUser(user *models.User) error {
	user.ID = primitive.NewObjectID()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	_, err := r.collection.InsertOne(context.Background(), user)
	return err
}

func (r *UserRepository) GenerateUserAwarePrompt(originalPrompt string) string {
	var user models.User
	username := config.UserName

	r.collection.FindOne(context.Background(), bson.M{"username": username}).Decode(&user)

	var userInfo []string
	if user.AboutMe != "" {
		userInfo = append(userInfo, fmt.Sprintf("About Me: %s", user.AboutMe))
	}
	if user.Preferences != "" {
		userInfo = append(userInfo, fmt.Sprintf("Preference: %s", user.Preferences))
	}

	userInfoText := ""
	if len(userInfo) > 0 {
		userInfoText = fmt.Sprintf("User info: %s. If required, use this knowledge before answering the question.", strings.Join(userInfo, ", "))
	}

	return fmt.Sprintf("%s\n\n%s", userInfoText, originalPrompt)
}
