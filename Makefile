# VisionPipeline Makefile
# =======================
# Production-grade Computer Vision MLOps Platform
# Owner: Selma Haci

.PHONY: dev build migrate test clean logs stop help

# --- DEVELOPMENT ---
dev: ## Start dev servers (Backend + Frontend)
	@echo "Starting Backend (FastAPI)..."
	cd backend && uvicorn app.main:app --reload --port 8000 &
	@echo "Starting Frontend (Vite)..."
	cd frontend && npm run dev -- --host

# --- DATABASE ---
migrate: ## Run database migrations (Alembic)
	@echo "Running migrations..."
	cd backend && alembic upgrade head

db-init: ## Initialize TimescaleDB hypertables
	@echo "Initializing database..."
	# Custom script to run SQL for hypertables

# --- DOCKER ---
build: ## Build all docker containers
	@echo "Building full stack..."
	docker-compose build --no-cache

docker-up: ## Start all services via docker-compose
	@echo "Starting services..."
	docker-compose up -d

docker-down: ## Stop all services
	@echo "Stopping services..."
	docker-compose down

# --- TESTING & LINT ---
test: ## Run unit and integration tests
	@echo "Running Pytest..."
	cd backend && pytest

lint: ## Run Ruff or Flake8 for code quality
	@echo "Running linter..."
	cd backend && ruff check .

# --- CLEANUP ---
clean: ## Remove build artifacts and temporary files
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} +
	rm -rf .pytest_cache
	rm -rf .ruff_cache

# --- MONITORING ---
logs: ## View backend logs
	docker-compose logs -f backend

# --- HELP ---
help: ## Show this help message
	@echo "VisionPipeline - MLOps Platform (Selma Haci)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[32m%-15s\033[0m %s\n", $$1, $$2}'
