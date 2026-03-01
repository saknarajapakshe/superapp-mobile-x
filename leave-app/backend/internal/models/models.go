package models

import "time"

type User struct {
    ID         string     `json:"id"`
    Email      string     `json:"email"`
    Role       UserRole   `json:"role"`
    Allowances Allowances `json:"allowances"`
	CreatedAt  time.Time  `json:"createdAt"`
}

type Allowances struct {
    Sick   int `json:"sick"`
    Annual int `json:"annual"`
    Casual int `json:"casual"`
}

type Leave struct {
    ID              string      `json:"id"`
    UserID          string      `json:"userId"`
    UserEmail       string      `json:"userEmail,omitempty"`
    Type            LeaveType   `json:"type"`
    StartDate       string      `json:"startDate"`
    EndDate         string      `json:"endDate"`
    TotalLeaveDays  float64     `json:"totalLeaveDays"`
    Reason          string      `json:"reason"`
    Status          LeaveStatus `json:"status"`
    ApproverComment *string     `json:"approverComment"`
    CreatedAt       time.Time   `json:"createdAt"`
    Days            []LeaveDay  `json:"days"`
}

type LeaveDay struct {
    ID             string         `json:"id"`
    LeaveID        string         `json:"leaveId"`
    Date           string         `json:"date"`
    IsHalfDay      bool           `json:"isHalfDay"`
    HalfDayPeriod  *HalfDayPeriod `json:"halfDayPeriod"`
}

type CreateLeaveRequest struct {
    Type           LeaveType      `json:"type" binding:"required"`
    StartDate      string         `json:"startDate" binding:"required"`
    EndDate        string         `json:"endDate" binding:"required"`
    Reason         string         `json:"reason" binding:"required"`
    IsHalfDay      *bool          `json:"isHalfDay"`
    HalfDayPeriod  *HalfDayPeriod `json:"halfDayPeriod"`
}

// UpdateLeaveRequest represents a unified request to update leave details
// Regular users can update dates/half-day fields for their own pending leaves
// Admins can update status/comment fields for any leave
type UpdateLeaveRequest struct {
    // Date fields (user can update for their own pending leaves)
    StartDate     *string        `json:"startDate"`
    EndDate       *string        `json:"endDate"`
    IsHalfDay     *bool          `json:"isHalfDay"`
    HalfDayPeriod *HalfDayPeriod `json:"halfDayPeriod"`
    
    // Status fields (admin only)
    Status        *LeaveStatus `json:"status"`
    Comment       *string      `json:"comment"`
}

// UpdateUserRoleRequest represents the request to update user role
type UpdateUserRoleRequest struct {
    Role UserRole `json:"role" binding:"required"`
}

// UpdateAllowancesRequest represents the request to update default allowances
type UpdateAllowancesRequest struct {
    Sick   *int `json:"sick"`
    Annual *int `json:"annual"`
    Casual *int `json:"casual"`
}

// Holiday represents a public holiday
type Holiday struct {
    ID   string `json:"id"`
    Date string `json:"date"`
    Name string `json:"name"`
}