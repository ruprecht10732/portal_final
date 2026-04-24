---
name: go-api-handler
description: Generate Go HTTP handlers following clean architecture patterns
compatibility: opencode
metadata:
  audience: backend-developers
  stack: go
---

## What I do

Generate Go HTTP handlers, services, and repository patterns following clean architecture and idiomatic Go conventions.

## When to use me

Use this skill when creating new API endpoints, handlers, services, or database repositories in the Go backend.

## Handler Template

```go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/yourorg/yourproject/internal/service"
)

type UserHandler struct {
	service *service.UserService
}

func NewUserHandler(s *service.UserService) *UserHandler {
	return &UserHandler{service: s}
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	user, err := h.service.Create(r.Context(), req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, user)
}
```

## Service Template

```go
package service

import (
	"context"
	"fmt"

	"github.com/yourorg/yourproject/internal/repository"
)

type UserService struct {
	repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Create(ctx context.Context, req CreateUserRequest) (*User, error) {
	// Business logic here
	return s.repo.Create(ctx, req)
}
```

## Repository Template

```go
package repository

import (
	"context"
	"database/sql"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, req CreateUserRequest) (*User, error) {
	query := `
		INSERT INTO users (id, email, name, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, email, name, created_at
	`
	var user User
	err := r.db.QueryRowContext(ctx, query, req.ID, req.Email, req.Name).Scan(
		&user.ID, &user.Email, &user.Name, &user.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return &user, nil
}
```

## Key Patterns

- **Context first**: Always accept `context.Context` as first parameter
- **Error wrapping**: Use `fmt.Errorf("...: %w", err)` for error wrapping
- **Interfaces**: Define interfaces for repositories (accept interfaces, return concrete types)
- **Pointer receivers**: Use pointer receivers for mutating operations
- **Struct tags**: Use `json:"fieldName,omitempty"` for API structs
- **Request/Response DTOs**: Separate API models from domain models

## Response Helpers

```go
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
```
