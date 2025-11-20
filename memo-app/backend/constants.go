package main

// HTTP Status Messages
const (
	ErrSenderEmailNotFound = "Sender email not found"
	ErrUserEmailNotFound   = "User email not found"
	ErrInvalidToken        = "Invalid or expired token"
	ErrTokenRequired       = "Token required for SSE subscription"
	ErrInvalidTTL          = "TTL must be at least 1 day if specified"
	ErrFailedToCreateMemo  = "Failed to create memo"

	MsgMemoSentSuccess = "Memo sent successfully"
)

// Database Defaults
const (
	DefaultTTLDays   = 7   // Default memo retention period in days
	DefaultPageLimit = 10  // Default number of memos per page
	MaxPageLimit     = 100 // Maximum allowed memos per page
)

// Server Configuration
const (
	DefaultPort        = "8080"
	DefaultDatabaseURL = "root:password@tcp(localhost:3306)/memo_db?charset=utf8mb4&parseTime=True&loc=Local"
)

// Service Names
const (
	ServiceName = "memo-app"
)

// Broadcast identifier
const (
	BroadcastRecipient = "broadcast"
)

// Database / connection defaults (tweak according to your environment)
const (
	ConnMaxLifetimeMinutes = 5  // number of minutes before a connection is recycled
	PingIntervalSeconds    = 60 // how often background pinger runs (seconds)
	MaxIdleConns           = 10 // maximum idle connections in the pool
	MaxOpenConns           = 50 // maximum open connections allowed
	ReconnectFailThreshold = 3  // consecutive ping failures before reconnect attempt
)
