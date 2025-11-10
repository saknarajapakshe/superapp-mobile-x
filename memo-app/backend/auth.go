package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jws"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

// JWTClaims represents the expected claims in the JWT token
type JWTClaims struct {
	Email string `json:"email"` // User's email address
}

var jwksCache jwk.Set

// InitJWKS initializes the JSON Web Key Set (JWKS) from the configured URL
// This is used to validate JWT tokens from the superapp backend
func InitJWKS() error {
	jwksURL := os.Getenv("JWKS_URL")
	if jwksURL == "" {
		return fmt.Errorf("JWKS_URL environment variable not configured")
	}

	cache := jwk.NewCache(context.Background())
	if err := cache.Register(jwksURL); err != nil {
		return fmt.Errorf("failed to register JWKS URL: %w", err)
	}

	ctx := context.Background()
	cached, err := cache.Refresh(ctx, jwksURL)
	if err != nil {
		return fmt.Errorf("failed to fetch JWKS from %s: %w", jwksURL, err)
	}

	jwksCache = cached
	return nil
}

// AuthMiddleware validates JWT tokens from the Authorization header
// Tokens must be in the format: "Bearer <token>"
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing Authorization header"})
			c.Abort()
			return
		}
		// Extract token from "Bearer <token>" format
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format. Expected: Bearer <token>"})
			c.Abort()
			return
		}
		tokenString := parts[1]

		// Parse and validate the JWT token
		token, err := jwt.Parse(
			[]byte(tokenString),
			jwt.WithKeySet(jwksCache, jws.WithInferAlgorithmFromKey(true)),
			jwt.WithValidate(true),
		)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Extract user information from token claims
		email, ok := token.Get("email")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Email claim not found in token"})
			c.Abort()
			return
		}
		// Store user info in request context for downstream handlers
		c.Set("userEmail", email)
		c.Next()
	}
}

// GetUserEmail retrieves the user email from the Gin context
func GetUserEmail(c *gin.Context) string {
	if email, exists := c.Get("userEmail"); exists {
		if emailStr, ok := email.(string); ok {
			return emailStr
		}
	}
	return ""
}
