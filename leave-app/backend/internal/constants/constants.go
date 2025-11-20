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

// Database / connection defaults (tweak according to your environment)
const (
	ConnMaxLifetimeMinutes = 5  // number of minutes before a connection is recycled
	PingIntervalSeconds    = 60 // how often background pinger runs (seconds)
	MaxIdleConns           = 10 // maximum idle connections in the pool
	MaxOpenConns           = 50 // maximum open connections allowed
	ReconnectFailThreshold = 3  // consecutive ping failures before reconnect attempt
)
