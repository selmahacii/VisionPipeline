# VisionPipeline Makefile
# =======================
# Production-grade Computer Vision MLOps Platform
#
# Usage:
#   make dev        - Start development environment
#   make build      - Build all services
#   make test       - Run tests
#   make migrate    - Run database migrations
#   make lint       - Run code linting
#   make clean      - Clean build artifacts
#   make logs       - View service logs
#   make stop       - Stop all services

.PHONY: dev build test migrate lint clean logs stop help

# Default target
.DEFAULT_GOAL := help

# Colors for output
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
RESET  := \033[0m

# Development
dev: ## Start development environment
	@echo "$(GREEN)Starting development environment...$(RESET)"
	bun run dev

# Building
build: ## Build all services
	@echo "$(GREEN)Building all services...$(RESET)"
	bun run build
	docker-compose build

build-next: ## Build Next.js application
	@echo "$(GREEN)Building Next.js application...$(RESET)"
	bun run build

build-docker: ## Build Docker images
	@echo "$(GREEN)Building Docker images...$(RESET)"
	docker-compose build

# Database
db-push: ## Push Prisma schema to database
	@echo "$(GREEN)Pushing database schema...$(RESET)"
	bun run db:push

db-generate: ## Generate Prisma client
	@echo "$(GREEN)Generating Prisma client...$(RESET)"
	bun run db:generate

db-reset: ## Reset database (WARNING: destroys data)
	@echo "$(YELLOW)Resetting database...$(RESET)"
	bun run db:reset

migrate: db-push db-generate ## Run database migrations
	@echo "$(GREEN)Migrations complete.$(RESET)"

# Testing
test: ## Run all tests
	@echo "$(GREEN)Running tests...$(RESET)"
	bun test

test-coverage: ## Run tests with coverage
	@echo "$(GREEN)Running tests with coverage...$(RESET)"
	bun test --coverage

# Code quality
lint: ## Run ESLint
	@echo "$(GREEN)Running linter...$(RESET)"
	bun run lint

lint-fix: ## Fix linting issues
	@echo "$(GREEN)Fixing linting issues...$(RESET)"
	bun run lint --fix

format: ## Format code
	@echo "$(GREEN)Formatting code...$(RESET)"
	bun run format || npx prettier --write "src/**/*.{ts,tsx}"

# Docker
docker-up: ## Start Docker services
	@echo "$(GREEN)Starting Docker services...$(RESET)"
	docker-compose up -d

docker-down: ## Stop Docker services
	@echo "$(GREEN)Stopping Docker services...$(RESET)"
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

# Services
start-cv-service: ## Start CV processing service
	@echo "$(GREEN)Starting CV service...$(RESET)"
	cd mini-services/cv-service && bun run dev

start-all: ## Start all services
	@echo "$(GREEN)Starting all services...$(RESET)"
	docker-compose up -d
	bun run dev

# Monitoring
logs: ## View development logs
	@echo "$(GREEN)Showing logs...$(RESET)"
	tail -f dev.log

logs-cv: ## View CV service logs
	@echo "$(GREEN)Showing CV service logs...$(RESET)"
	docker-compose logs -f cv-service

# Cleanup
clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(RESET)"
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf coverage
	rm -rf .turbo

clean-all: clean ## Clean everything including dependencies
	@echo "$(YELLOW)Cleaning everything...$(RESET)"
	rm -rf node_modules
	rm -rf bun.lock
	bun install

# Installation
install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	bun install

install-cv: ## Install CV service dependencies
	@echo "$(GREEN)Installing CV service dependencies...$(RESET)"
	cd mini-services/cv-service && bun install

# Utility
stop: ## Stop all services
	@echo "$(GREEN)Stopping all services...$(RESET)"
	pkill -f "next dev" || true
	docker-compose down || true

status: ## Show status of services
	@echo "$(GREEN)Service Status:$(RESET)"
	@echo "Next.js Dev Server:"
	@pgrep -f "next dev" > /dev/null && echo "  ✓ Running" || echo "  ✗ Stopped"
	@echo ""
	@echo "CV Service:"
	@pgrep -f "cv-service" > /dev/null && echo "  ✓ Running" || echo "  ✗ Stopped"
	@echo ""
	@echo "Docker Services:"
	@docker-compose ps 2>/dev/null || echo "  Docker not running"

# Help
help: ## Show this help message
	@echo "$(BLUE)VisionPipeline - Production MLOps Platform$(RESET)"
	@echo ""
	@echo "$(YELLOW)Usage:$(RESET) make [target]"
	@echo ""
	@echo "$(YELLOW)Targets:$(RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(RESET) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Examples:$(RESET)"
	@echo "  make dev        # Start development"
	@echo "  make test       # Run tests"
	@echo "  make lint       # Check code quality"
	@echo "  make docker-up  # Start Docker services"
