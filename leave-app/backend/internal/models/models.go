// internal/models/models.go
package models

import "time"

type Allowance struct {
	Sick   int `json:"sick"`
	Annual int `json:"annual"`
	Casual int `json:"casual"`
}

type User struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Role        string    `json:"role"`
	Allowances  Allowance `json:"allowances"`
	CreatedAt   time.Time `json:"-"` // Exclude from JSON responses
}

type Leave struct {
	ID              string    `json:"id"`
	UserID          string    `json:"userId"`
	UserEmail       string    `json:"userEmail,omitempty"` // Used for GET requests
	Type            string    `json:"type"`
	StartDate       string    `json:"startDate"`
	EndDate         string    `json:"endDate"`
	Reason          string    `json:"reason"`
	Status          string    `json:"status"`
	ApproverComment *string   `json:"approverComment,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}

// For POST /api/leaves
type CreateLeaveRequest struct {
	Type      string `json:"type" binding:"required"`
	StartDate string `json:"startDate" binding:"required"`
	EndDate   string `json:"endDate" binding:"required"`
	Reason    string `json:"reason" binding:"required"`
}

// For PUT /api/admin/allowances
type UpdateAllowancesRequest struct {
	Sick   int `json:"sick"`
	Annual int `json:"annual"`
	Casual int `json:"casual"`
}

// For PUT /api/leaves/:id/approve or /reject
type UpdateLeaveStatusRequest struct {
	Status  string  `json:"status"`
	Comment *string `json:"comment,omitempty"`
}

// For PUT /api/users/:id/role
type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}
