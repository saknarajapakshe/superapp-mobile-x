package models

// Default user settings
const (
	DefaultUserRole = UserRoleUser
)

// Default allowances for new users
const (
	DefaultAnnualAllowance = 10
	DefaultSickAllowance   = 15
	DefaultCasualAllowance = 5
)

type LeaveStatus string
// Leave status constants
const (
	LeaveStatusPending  LeaveStatus = "pending"
	LeaveStatusApproved LeaveStatus = "approved"
	LeaveStatusRejected LeaveStatus = "rejected"
)

type LeaveType string

// Leave type constants
const (
	LeaveTypeSick   LeaveType = "sick"
	LeaveTypeAnnual LeaveType = "annual"
	LeaveTypeCasual LeaveType = "casual"
)

type UserRole string	

// User role constants
const (
	UserRoleUser  UserRole = "user"
	UserRoleAdmin UserRole = "admin"
)

type HalfDayPeriod string

// Half-day period constants
const (
	HalfDayPeriodMorning HalfDayPeriod = "morning"
	HalfDayPeriodEvening HalfDayPeriod = "evening"
)
