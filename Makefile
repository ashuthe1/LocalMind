.PHONY: build frontend backend dev run test lint clean docker

build: frontend backend            ## Build the UI and the single binary at bin/localmind

frontend:                          ## Build the web UI into backend/web/dist
	cd frontend && npm install && npm run build

backend:                           ## Compile the Go binary (embeds backend/web/dist)
	mkdir -p bin && cd backend && go build -o ../bin/localmind ./cmd/server

run: build                         ## Build then run
	./bin/localmind

dev:                               ## Backend + Vite dev server with hot reload
	./start.sh --dev

test:                              ## Go unit tests + frontend lint
	cd backend && go test ./...
	cd frontend && npm run lint

lint:
	cd backend && go vet ./... && gofmt -l .
	cd frontend && npm run lint

docker:                            ## Build the Docker image
	docker build -t localmind .

clean:
	rm -rf bin backend/web/dist/* frontend/dist
	touch backend/web/dist/.gitkeep
