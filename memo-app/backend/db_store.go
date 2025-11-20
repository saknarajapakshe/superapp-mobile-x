package main

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DBStore implements persistent storage for memos using GORM with MySQL
type DBStore struct {
	db    *gorm.DB
	cache *CacheManager
	mu    sync.Mutex
}

// NewDBStore creates a new database store with the given MySQL DSN
// DSN format: username:password@tcp(host:port)/dbname?charset=utf8mb4&parseTime=True&loc=Local
func NewDBStore(dsn string, cache *CacheManager) (*DBStore, error) {
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	// Auto-migrate memo model to create/update table schema
	if err := db.AutoMigrate(&Memo{}); err != nil {
		return nil, err
	}

	// Configure underlying sql.DB connection pool if available
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetConnMaxLifetime(time.Duration(ConnMaxLifetimeMinutes) * time.Minute)
		sqlDB.SetMaxIdleConns(MaxIdleConns)
		sqlDB.SetMaxOpenConns(MaxOpenConns)
	}

	s := &DBStore{db: db, cache: cache}

	log.Println("Database connection established and schema migrated successfully")

	// Background pinger and simple reconnect logic
	go func(dsn string, store *DBStore) {
		ticker := time.NewTicker(time.Duration(PingIntervalSeconds) * time.Second)
		defer ticker.Stop()
		failCount := 0
		for range ticker.C {
			store.mu.Lock()
			sqlDB, err := store.db.DB()
			store.mu.Unlock()
			if err != nil {
				log.Printf("dbstore: could not get sql.DB: %v", err)
				failCount++
			} else {
				if err := sqlDB.Ping(); err != nil {
					log.Printf("dbstore: ping failed: %v", err)
					failCount++
				} else {
					failCount = 0
					continue
				}
			}

			if failCount >= ReconnectFailThreshold {
				log.Println("dbstore: attempting reconnect after repeated ping failures")
				newDB, err := gorm.Open(mysql.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Info)})
				if err != nil {
					log.Printf("dbstore: reconnect open failed: %v", err)
					continue
				}
				if err := newDB.AutoMigrate(&Memo{}); err != nil {
					log.Printf("dbstore: reconnect migrate failed: %v", err)
					continue
				}
				if sqlNew, err := newDB.DB(); err == nil {
					sqlNew.SetConnMaxLifetime(time.Duration(ConnMaxLifetimeMinutes) * time.Minute)
					sqlNew.SetMaxIdleConns(MaxIdleConns)
					sqlNew.SetMaxOpenConns(MaxOpenConns)
				}

				// swap in new gorm DB
				store.mu.Lock()
				old := store.db
				store.db = newDB
				store.mu.Unlock()
				_ = old
				log.Println("dbstore: reconnect successful")
				failCount = 0
			}
		}
	}(dsn, s)

	return s, nil
}

// Add creates a new memo in the database
func (s *DBStore) Add(memo *Memo) string {
	if memo.ID == "" {
		memo.ID = uuid.New().String()
	}
	memo.Status = StatusSent
	memo.CreatedAt = time.Now()

	if err := s.db.Create(memo).Error; err != nil {
		log.Printf("Error creating memo: %v", err)
		return ""
	}

	// Cache the memo
	s.cache.SetMemo(memo)

	// Invalidate sender's sent memo cache
	s.cache.InvalidateUserMemos(memo.From)

	// Invalidate recipient's received memo cache (or all if broadcast)
	if memo.IsBroadcast {
		s.cache.InvalidateBroadcastMemos()
	} else {
		s.cache.InvalidateUserMemos(memo.To)
	}

	return memo.ID
}

// Get retrieves a memo by its ID
func (s *DBStore) Get(id string) (*Memo, bool) {
	// Try cache first
	if memo, ok := s.cache.GetMemo(id); ok {
		return memo, true
	}

	// Fetch from database
	var memo Memo
	if err := s.db.First(&memo, "id = ?", id).Error; err != nil {
		return nil, false
	}

	// Cache for future requests
	s.cache.SetMemo(&memo)

	return &memo, true
}

// GetSentMemos retrieves all memos sent by a specific user with pagination
func (s *DBStore) GetSentMemos(userEmail string, limit int, offset int) []*Memo {
	// Generate cache key
	cacheKey := fmt.Sprintf("sent:%s:%d:%d", userEmail, limit, offset)

	// Try cache first
	if memos, ok := s.cache.GetMemoList(cacheKey); ok {
		return memos
	}

	// Fetch from database
	var memos []*Memo
	s.db.Order("created_at desc").Where("`from` = ?", userEmail).Limit(limit).Offset(offset).Find(&memos)

	// Cache the result
	s.cache.SetMemoList(cacheKey, memos)

	return memos
}

// GetReceivedMemos retrieves all memos received by a user with pagination
// Includes both direct messages (status=sent) and all broadcast messages
func (s *DBStore) GetReceivedMemos(userEmail string, limit int, offset int) []*Memo {
	// Generate cache key
	cacheKey := fmt.Sprintf("received:%s:%d:%d", userEmail, limit, offset)

	// Try cache first
	if memos, ok := s.cache.GetMemoList(cacheKey); ok {
		return memos
	}

	// Fetch from database
	var memos []*Memo
	s.db.Order("created_at desc").Where(
		"(`to` = ? AND status = ?) OR is_broadcast = ?",
		userEmail, StatusSent, true,
	).Limit(limit).Offset(offset).Find(&memos)

	// Cache the result
	s.cache.SetMemoList(cacheKey, memos)

	return memos
}

// UpdateStatus updates the status of a memo
func (s *DBStore) UpdateStatus(id string, status MemoStatus) bool {
	updates := map[string]interface{}{"status": status}

	if status == StatusDelivered {
		now := time.Now()
		updates["delivered_at"] = &now
	}

	result := s.db.Model(&Memo{}).Where("id = ?", id).Updates(updates)

	if result.RowsAffected > 0 {
		// Invalidate cached memo
		s.cache.InvalidateMemo(id)

		// Get the memo to invalidate related caches
		if memo, ok := s.Get(id); ok {
			s.cache.InvalidateUserMemos(memo.From)
			s.cache.InvalidateUserMemos(memo.To)
		}

		return true
	}

	return false
}

// Delete removes a memo from the database
func (s *DBStore) Delete(id string) bool {
	// Get the memo first to invalidate related caches
	memo, exists := s.Get(id)

	result := s.db.Delete(&Memo{}, "id = ?", id)

	if result.RowsAffected > 0 {
		// Invalidate cached memo
		s.cache.InvalidateMemo(id)

		// Invalidate related user caches if memo was found
		if exists {
			s.cache.InvalidateUserMemos(memo.From)
			if memo.IsBroadcast {
				s.cache.InvalidateBroadcastMemos()
			} else {
				s.cache.InvalidateUserMemos(memo.To)
			}
		}

		return true
	}

	return false
}

// StartCleanup periodically removes old memos based on TTL and delivery status
// Runs cleanup every hour until the context is cancelled
func (s *DBStore) StartCleanup(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Println("Cleanup routine started - running every hour")

	for {
		select {
		case <-ctx.Done():
			log.Println("Cleanup routine stopped")
			return
		case <-ticker.C:
			s.cleanup()
		}
	}
}

// cleanup removes expired memos based on the following rules:
// 1. Delivered messages older than 1 hour
// 2. Messages with custom TTL that have expired
// 3. Sent messages older than 24 hours (with no custom TTL)
func (s *DBStore) cleanup() {
	now := time.Now()

	// Delete delivered memos older than 1 hour
	cutoffDelivered := now.Add(-1 * time.Hour)
	result := s.db.Where("status = ? AND delivered_at IS NOT NULL AND delivered_at < ?",
		StatusDelivered, cutoffDelivered).Delete(&Memo{})
	if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d delivered memos older than 1 hour", result.RowsAffected)
	}

	// Delete memos with custom TTL that have expired
	var memosWithTTL []*Memo
	s.db.Where("ttl_days IS NOT NULL AND status = ?", StatusSent).Find(&memosWithTTL)
	deletedCount := 0
	for _, memo := range memosWithTTL {
		expiryTime := memo.CreatedAt.Add(time.Duration(*memo.TTLDays) * 24 * time.Hour)
		if now.After(expiryTime) {
			s.db.Delete(memo)
			deletedCount++
		}
	}
	if deletedCount > 0 {
		log.Printf("Cleaned up %d memos with expired custom TTL", deletedCount)
	}

	// Delete sent memos older than 24 hours (only if no custom TTL)
	cutoffSent := now.Add(-24 * time.Hour)
	result = s.db.Where("status = ? AND created_at < ? AND ttl_days IS NULL",
		StatusSent, cutoffSent).Delete(&Memo{})
	if result.RowsAffected > 0 {
		log.Printf("Cleaned up %d sent memos older than 24 hours", result.RowsAffected)
	}
}
