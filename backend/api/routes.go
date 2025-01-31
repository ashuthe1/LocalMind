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

	return router
}