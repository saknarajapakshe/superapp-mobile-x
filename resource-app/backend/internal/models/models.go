package models

import (
	"encoding/json"
	"time"
)

// UserRole represents the role of a user
type UserRole string

const (
	RoleUser  UserRole = "USER"
	RoleAdmin UserRole = "ADMIN"
)

// BookingStatus represents the status of a booking
type BookingStatus string

const (
	StatusPending   BookingStatus = "pending"
	StatusConfirmed BookingStatus = "confirmed"
	StatusRejected  BookingStatus = "rejected"
	StatusCancelled BookingStatus = "cancelled"
	StatusCompleted BookingStatus = "completed"
	StatusCheckedIn BookingStatus = "checked_in"
	StatusProposed  BookingStatus = "proposed"
)

// User represents a user in the system
type User struct {
	ID         string   `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Email      string   `json:"email" gorm:"uniqueIndex;type:varchar(255);not null"`
	Role       UserRole `json:"role" gorm:"type:varchar(20);default:'USER'"`
	Avatar     string   `json:"avatar" gorm:"type:varchar(255)"`
	Department string   `json:"department" gorm:"type:varchar(100)"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// Resource represents a bookable resource
type Resource struct {
	ID               string          `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name             string          `json:"name" gorm:"type:varchar(100);not null"`
	Type             string          `json:"type" gorm:"type:varchar(50);not null"`
	Description      string          `json:"description" gorm:"type:text"`
	IsActive         bool            `json:"isActive" gorm:"default:true"`
	MinLeadTimeHours int             `json:"minLeadTimeHours" gorm:"default:0"`
	Icon             string          `json:"icon" gorm:"type:varchar(50)"`
	Color            string          `json:"color" gorm:"type:varchar(20)"`
	Specs            json.RawMessage `json:"specs" gorm:"type:json"`      // Stored as JSON
	FormFields       json.RawMessage `json:"formFields" gorm:"type:json"` // Stored as JSON
	CreatedAt        time.Time       `json:"createdAt" gorm:"autoCreateTime"`
}

// Booking represents a reservation of a resource
type Booking struct {
	ID              string          `json:"id" gorm:"primaryKey;type:varchar(36)"`
	ResourceID      string          `json:"resourceId" gorm:"index;type:varchar(36);not null"`
	UserID          string          `json:"userId" gorm:"index;type:varchar(36);not null"`
	Start           time.Time       `json:"start" gorm:"not null"`
	End             time.Time       `json:"end" gorm:"not null"`
	Status          BookingStatus   `json:"status" gorm:"index;type:varchar(20);default:'pending'"`
	CreatedAt       time.Time       `json:"createdAt" gorm:"autoCreateTime"`
	RejectionReason *string         `json:"rejectionReason,omitempty" gorm:"type:text"`
	Details         json.RawMessage `json:"details" gorm:"type:json"` // Stored as JSON
}
