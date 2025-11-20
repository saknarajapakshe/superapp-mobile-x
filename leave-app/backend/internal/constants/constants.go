// internal/constants/constants.go
package constants

type Role string
type LeaveStatus string
type LeaveType string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

const (
	LeaveStatusPending  LeaveStatus = "pending"
	LeaveStatusApproved LeaveStatus = "approved"
	LeaveStatusRejected LeaveStatus = "rejected"
)

const (
	LeaveTypeSick   LeaveType = "sick"
	LeaveTypeAnnual LeaveType = "annual"
	LeaveTypeCasual LeaveType = "casual"
)

const (
	ContextUserKey = "user"
)
