// services/user_service.go
package services

import (
	"github.com/ashuthe1/localmind/models"
	"github.com/ashuthe1/localmind/repository"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserService struct {
	UserRepo *repository.UserRepository
}

func NewUserService(userRepo *repository.UserRepository) *UserService {
	return &UserService{UserRepo: userRepo}
}

// GetUserByID returns the user for a given ID.
func (s *UserService) GetUserByID(id primitive.ObjectID) (*models.User, error) {
	return s.UserRepo.GetUserByID(id)
}

// UpdateUserSettings overwrites AboutMe and Preferences fields.
func (s *UserService) UpdateUserSettings(id primitive.ObjectID, aboutMe, preferences string) error {
	user, err := s.UserRepo.GetUserByID(id)
	if err != nil {
		return err
	}

	// Overwrite fields instead of appending
	user.AboutMe = aboutMe
	user.Preferences = preferences

	return s.UserRepo.UpdateUser(user)
}
