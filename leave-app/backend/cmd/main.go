// cmd/main.go
package main

import (
	"leave-app/internal/db"
	"leave-app/internal/handlers"
	"leave-app/internal/service"
	"leave-app/pkg/auth"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	database, err := db.NewDatabase()
	if err != nil {
		log.Fatalf("Could not connect to the database: %v", err)
	}

	// Run migrations
	if err := database.Migrate(); err != nil {
		log.Fatalf("Could not run database migrations: %v", err)
	}

	// Initialize services
	userService := service.NewUserService(database)

	// Initialize authenticator
	authenticator, err := auth.New(userService)
	if err != nil {
		log.Fatalf("Failed to initialize authenticator: %v", err)
	}

	// Create Gin router
	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Initialize handlers
	h := handlers.NewHandler(database)

	// Setup routes
	api := r.Group("/api")
	api.Use(authenticator.AuthMiddleware())
	{
		api.GET("/me", h.GetCurrentUser)
		api.GET("/users", h.GetAllUsers)
		api.PUT("/admin/allowances", h.UpdateDefaultAllowances)
		api.PUT("/users/:id/role", h.UpdateUserRole)
		api.GET("/leaves", h.GetLeaves)
		api.GET("/leaves/:id", h.GetLeaveByID)
		api.POST("/leaves", h.CreateLeave)
		api.PUT("/leaves/:id", h.UpdateLeave) // Unified endpoint with RBAC for dates and status
		api.DELETE("/leaves/:id", h.DeleteLeave)
		api.GET("/holidays", h.GetHolidays)
	}

	// A simple health check route
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	// Start server
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
