// internal/db/db.go
package db

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"leave-app/internal/constants"
	"log"
	"os"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type Database struct {
    Conn *sql.DB
    mu   sync.Mutex
}

// NewDatabase creates a new database connection
func NewDatabase() (*Database, error) {
    dbUser := os.Getenv("DB_USER")
    dbPassword := os.Getenv("DB_PASSWORD")
    dbHost := os.Getenv("DB_HOST")
    dbPort := os.Getenv("DB_PORT")
    dbName := os.Getenv("DB_NAME")

    dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&multiStatements=true", dbUser, dbPassword, dbHost, dbPort, dbName)

    db, err := sql.Open("mysql", dsn)
    if err != nil {
        return nil, err
    }

    // Pool tuning - tune according to your workload and DB limits
    db.SetConnMaxLifetime(time.Duration(constants.ConnMaxLifetimeMinutes) * time.Minute)
    db.SetMaxIdleConns(constants.MaxIdleConns)
    db.SetMaxOpenConns(constants.MaxOpenConns)

    if err := db.Ping(); err != nil {
        return nil, err
    }

    d := &Database{Conn: db}

    log.Println("Database connection established")

    // Background pinger to keep connections fresh and detect problems early.
    go func(dsn string, database *Database) {
        ticker := time.NewTicker(time.Duration(constants.PingIntervalSeconds) * time.Second)
        defer ticker.Stop()
        failCount := 0
        for range ticker.C {
            database.mu.Lock()
            err := database.Conn.Ping()
            database.mu.Unlock()
            if err != nil {
                log.Printf("DB ping failed: %v", err)
                failCount++
            } else {
                failCount = 0
                continue
            }

            // If we've had several consecutive failures, try a reconnect
            if failCount >= constants.ReconnectFailThreshold {
                log.Println("Attempting DB reconnect after repeated ping failures")
                newDB, err := sql.Open("mysql", dsn)
                if err != nil {
                    log.Printf("reconnect: sql.Open error: %v", err)
                    continue
                }
                newDB.SetConnMaxLifetime(time.Duration(constants.ConnMaxLifetimeMinutes) * time.Minute)
                newDB.SetMaxIdleConns(constants.MaxIdleConns)
                newDB.SetMaxOpenConns(constants.MaxOpenConns)
                if err := newDB.Ping(); err != nil {
                    log.Printf("reconnect: ping failed: %v", err)
                    _ = newDB.Close()
                    continue
                }

                // swap in new connection
                database.mu.Lock()
                old := database.Conn
                database.Conn = newDB
                database.mu.Unlock()
                _ = old.Close()
                log.Println("DB reconnect successful")
                failCount = 0
            }
        }
    }(dsn, d)

    return d, nil
}

// Migrate runs the database migrations
func (db *Database) Migrate() error {
    if os.Getenv("RUN_MIGRATIONS") != "true" {
        log.Println("Skipping database migrations (RUN_MIGRATIONS != true)")
        return nil
    }

    // ensure the migrations tracking table exists
    create := `CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY
    )`
    if _, err := db.Conn.Exec(create); err != nil {
        return fmt.Errorf("could not create schema_migrations table: %w", err)
    }

    // List of migration files to run in order
    migrations := []string{
        "migrations/001_initial.sql",
        "migrations/002_initial_schema.sql",
        "migrations/002_insert_seed_data.sql",
    }

    for _, migrationFile := range migrations {
        // check if this migration has already been applied
        var exists string
        err := db.Conn.QueryRow("SELECT version FROM schema_migrations WHERE version = ?", migrationFile).Scan(&exists)
        if err == nil {
            // already applied
            continue
        }
        if err != sql.ErrNoRows {
            return fmt.Errorf("could not check migration %s: %w", migrationFile, err)
        }

        query, err := ioutil.ReadFile(migrationFile)
        if err != nil {
            return fmt.Errorf("could not read migration file %s: %w", migrationFile, err)
        }

        tx, err := db.Conn.Begin()
        if err != nil {
            return fmt.Errorf("could not begin transaction for migration %s: %w", migrationFile, err)
        }

        if _, err := tx.Exec(string(query)); err != nil {
            tx.Rollback()
            return fmt.Errorf("could not apply migration %s: %w", migrationFile, err)
        }

        if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", migrationFile); err != nil {
            tx.Rollback()
            return fmt.Errorf("could not record migration %s: %w", migrationFile, err)
        }

        if err := tx.Commit(); err != nil {
            return fmt.Errorf("could not commit migration %s: %w", migrationFile, err)
        }

        log.Printf("Migration applied: %s", migrationFile)
    }

    log.Println("Database migrations checked/applied successfully")
    return nil
}



