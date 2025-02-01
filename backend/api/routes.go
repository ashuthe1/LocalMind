// api/routes.go

package api

import (
	"net/http"

	"github.com/gorilla/mux"
)

func SetupRoutes(handler *Handler) *mux.Router {
	router := mux.NewRouter().StrictSlash(true)
	apiRouter := router.PathPrefix("/api").Subrouter()

	// Chat routes
	apiRouter.HandleFunc("/chat", handler.SendMessageHandler).Methods(http.MethodPost)
	apiRouter.HandleFunc("/chats", handler.GetChatsHandler).Methods(http.MethodGet)
	apiRouter.HandleFunc("/chat/{id}", handler.DeleteChatHandler).Methods(http.MethodDelete)
	apiRouter.HandleFunc("/chats", handler.DeleteAllChatsHandler).Methods(http.MethodDelete)

	// User settings routes
	apiRouter.HandleFunc("/user", handler.GetUserSettingsHandler).Methods(http.MethodGet)
	apiRouter.HandleFunc("/user", handler.UpdateUserSettingsHandler).Methods(http.MethodPut)
	apiRouter.HandleFunc("/create-user", handler.CreateUserHandler).Methods(http.MethodPost)
	return router
}
