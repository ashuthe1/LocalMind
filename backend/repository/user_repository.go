// repository/user_repository.go
package repository

import (
	"context"
	"time"

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

// UpdateUser updates the user's settings.
// In this example, we update only the AboutMe and Preferences fields.
func (r *UserRepository) UpdateUser(user *models.User) error {
	user.UpdatedAt = time.Now()
	filter := bson.M{"_id": user.ID}
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
