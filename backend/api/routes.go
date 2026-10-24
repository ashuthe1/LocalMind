package api

import (
	"net/http"

	"github.com/gorilla/mux"
)

// SetupRoutes wires the API routes and the SPA handler.
func SetupRoutes(h *Handler, frontend http.Handler, corsOrigins []string) http.Handler {
	router := mux.NewRouter().StrictSlash(true)
	api := router.PathPrefix("/api").Subrouter()

	api.HandleFunc("/health", h.Health).Methods(http.MethodGet)

	api.HandleFunc("/settings", h.GetSettings).Methods(http.MethodGet)
	api.HandleFunc("/settings", h.UpdateSettings).Methods(http.MethodPut, http.MethodPatch)

	api.HandleFunc("/providers/catalog", h.ProviderCatalog).Methods(http.MethodGet)
	api.HandleFunc("/providers/test", h.TestUnsavedProvider).Methods(http.MethodPost)
	api.HandleFunc("/providers", h.ListProviders).Methods(http.MethodGet)
	api.HandleFunc("/providers", h.CreateProvider).Methods(http.MethodPost)
	api.HandleFunc("/providers/{id}", h.UpdateProvider).Methods(http.MethodPut)
	api.HandleFunc("/providers/{id}", h.DeleteProvider).Methods(http.MethodDelete)
	api.HandleFunc("/providers/{id}/models", h.ProviderModels).Methods(http.MethodGet)
	api.HandleFunc("/providers/{id}/test", h.TestProvider).Methods(http.MethodPost)

	api.HandleFunc("/user", h.GetUser).Methods(http.MethodGet)
	api.HandleFunc("/user", h.UpdateUser).Methods(http.MethodPut, http.MethodPatch)

	api.HandleFunc("/chat", h.SendMessage).Methods(http.MethodPost)
	api.HandleFunc("/chats", h.ListChats).Methods(http.MethodGet)
	api.HandleFunc("/chats", h.CreateChat).Methods(http.MethodPost)
	api.HandleFunc("/chats", h.DeleteAllChats).Methods(http.MethodDelete)
	api.HandleFunc("/chats/{id}", h.GetChat).Methods(http.MethodGet)
	api.HandleFunc("/chats/{id}", h.PatchChat).Methods(http.MethodPatch, http.MethodPut)
	api.HandleFunc("/chats/{id}", h.DeleteChat).Methods(http.MethodDelete)
	api.HandleFunc("/chats/{id}/export", h.ExportChat).Methods(http.MethodGet)
	api.HandleFunc("/chats/{id}/regenerate", h.Regenerate).Methods(http.MethodPost)
	api.HandleFunc("/chats/{id}/messages/{mid}", h.UpdateMessage).Methods(http.MethodPut, http.MethodPatch)
	api.HandleFunc("/chats/{id}/messages/{mid}", h.DeleteMessage).Methods(http.MethodDelete)

	api.HandleFunc("/export", h.ExportAll).Methods(http.MethodGet)
	api.HandleFunc("/import", h.ImportAll).Methods(http.MethodPost)

	// Legacy routes from LocalMind 1.x
	api.HandleFunc("/create-user", h.LegacyCreateUser).Methods(http.MethodPost)
	api.HandleFunc("/chat-init", h.LegacyChatInit).Methods(http.MethodPost)
	api.HandleFunc("/chat/{id}", h.DeleteChat).Methods(http.MethodDelete)

	api.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "no such API route")
	})
	api.MethodNotAllowedHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	})

	if frontend != nil {
		router.PathPrefix("/").Handler(frontend)
	}

	var handler http.Handler = router
	handler = requestLogger(handler)
	handler = cors(corsOrigins)(handler)
	handler = recoverer(handler)
	return handler
}
