// pkg/auth/auth.go
package auth

import (
	"context"
	"log"
	"lsf-leave-backend/internal/constants"
	"lsf-leave-backend/internal/db"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

type Authenticator struct {
	DB   *db.Database
	jwks jwk.Set
}

func New(db *db.Database) (*Authenticator, error) {
	jwksURL := os.Getenv("JWKS_URL")
	if jwksURL == "" {
		log.Fatal("JWKS_URL environment variable not set")
	}

	ctx, cancel := context.WithCancel(context.Background())

	set, err := jwk.Fetch(ctx, jwksURL)
	if err != nil {
		cancel()
		return nil, err
	}

	auth := &Authenticator{
		DB:   db,
		jwks: set,
	}

	// Refresh JWKS in the background
	go auth.refreshJwks(ctx, jwksURL)

	return auth, nil
}

func (a *Authenticator) refreshJwks(ctx context.Context, jwksURL string) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			set, err := jwk.Fetch(ctx, jwksURL)
			if err != nil {
				log.Printf("Failed to refresh JWKS: %v", err)
				continue
			}
			a.jwks = set
			log.Println("Successfully refreshed JWKS")
		case <-ctx.Done():
			return
		}
	}
}

func (a *Authenticator) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format"})
			return
		}

		token, err := jwt.ParseString(parts[1], jwt.WithKeySet(a.jwks))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		email, ok := token.Get("email")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Email claim not found in token"})
			return
		}

		emailStr, ok := email.(string)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid email claim type"})
			return
		}

		user, err := a.DB.GetUserByEmail(emailStr)
		if err != nil {
			// If user not found, create a new user
			if err.Error() == "sql: no rows in result set" {
				user, err = a.DB.CreateUser(emailStr)
				if err != nil {
					c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
					return
				}
			} else {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
				return
			}
		}

		// Store the user in the context

		c.Set(constants.ContextUserKey, user)

		c.Next()

	}

}
