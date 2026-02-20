// internal/db/db.go
package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/ioutil"
	"leave-app/internal/constants"
	"leave-app/internal/models"
	"log"
	"os"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
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
    // List of migration files to run in order
    migrations := []string{
        "migrations/001_initial.sql",
        "migrations/002_holidays.sql",
        "migrations/003_add_leave_day_fields.sql",
        "migrations/004_fix_leaves_table.sql",
    }

    for _, migrationFile := range migrations {
        query, err := ioutil.ReadFile(migrationFile)
        if err != nil {
            return fmt.Errorf("could not read migration file %s: %w", migrationFile, err)
        }

        if _, err := db.Conn.Exec(string(query)); err != nil {
            return fmt.Errorf("could not apply migration %s: %w", migrationFile, err)
        }

        log.Printf("Migration applied: %s", migrationFile)
    }

    log.Println("Database migration applied successfully")
    return nil
}

func (db *Database) GetUserByEmail(email string) (*models.User, error) {
	user := &models.User{}
	query := "SELECT id, email, role, sick_allowance, annual_allowance, casual_allowance, created_at FROM users WHERE email = ?"
	err := db.Conn.QueryRow(query, email).Scan(&user.ID, &user.Email, &user.Role, &user.Allowances.Sick, &user.Allowances.Annual, &user.Allowances.Casual, &user.CreatedAt)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (db *Database) UpdateUserRole(userID string, role string) error {
	query := "UPDATE users SET role = ? WHERE id = ?"
	_, err := db.Conn.Exec(query, role, userID)
	return err
}

func (db *Database) GetAllUsers() ([]models.User, error) {
	rows, err := db.Conn.Query("SELECT id, email, role, sick_allowance, annual_allowance, casual_allowance, created_at FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]models.User, 0)
	for rows.Next() {
		var user models.User
		if err := rows.Scan(&user.ID, &user.Email, &user.Role, &user.Allowances.Sick, &user.Allowances.Annual, &user.Allowances.Casual, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

func (db *Database) UpdateAllUserAllowances(req models.UpdateAllowancesRequest) error {
	query := "UPDATE users SET sick_allowance = ?, annual_allowance = ?, casual_allowance = ?"
	_, err := db.Conn.Exec(query, req.Sick, req.Annual, req.Casual)
	return err
}

func (db *Database) CreateLeave(leave *models.Leave) error {
	leave.ID = uuid.New().String()
	query := "INSERT INTO leaves (id, user_id, type, start_date, end_date, total_days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	_, err := db.Conn.Exec(query, leave.ID, leave.UserID, leave.Type, leave.StartDate, leave.EndDate, leave.TotalLeaveDays, leave.Reason, leave.Status)
	return err
}

func (db *Database) GetAllLeaves() ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		ORDER BY l.created_at DESC
	`
	rows, err := db.Conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	leaves := make([]models.Leave, 0)
	for rows.Next() {
		var leave models.Leave
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
	}
	return leaves, nil
}

func (db *Database) GetLeavesByUserID(userID string) ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		WHERE l.user_id = ?
		ORDER BY l.created_at DESC
	`
	rows, err := db.Conn.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	leaves := make([]models.Leave, 0)
	for rows.Next() {
		var leave models.Leave
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
	}
	return leaves, nil
}

func (db *Database) GetLeaveByID(leaveID string) (*models.Leave, error) {
	leave := &models.Leave{}
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		WHERE l.id = ?
	`
	err := db.Conn.QueryRow(query, leaveID).Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt)
	if err != nil {
		return nil, err
	}
	return leave, nil
}

func (db *Database) CreateUser(email string) (*models.User, error) {
	user := &models.User{
		ID:    uuid.New().String(),
		Email: email,
		Role:  "user",
		Allowances: models.Allowance{
			Annual: 20,
			Sick:   10,
			Casual: 5,
		},
	}
	query := "INSERT INTO users (id, email, role, annual_allowance, sick_allowance, casual_allowance) VALUES (?, ?, ?, ?, ?, ?)"
	_, err := db.Conn.Exec(query, user.ID, user.Email, user.Role, user.Allowances.Annual, user.Allowances.Sick, user.Allowances.Casual)
	if err != nil {
		return nil, err
	}
	return db.GetUserByEmail(email)
}

func (db *Database) UpdateLeaveStatus(leaveID string, status string, comment *string) error {
	query := "UPDATE leaves SET status = ?, approver_comment = ? WHERE id = ?"
	_, err := db.Conn.Exec(query, status, comment, leaveID)
	return err
}

func (db *Database) DeleteLeave(leaveID string) error {
	query := "DELETE FROM leaves WHERE id = ?"
	_, err := db.Conn.Exec(query, leaveID)
	return err
}

// CreateLeaveDays inserts leave day records for a leave
func (d *Database) CreateLeaveDays(leaveID string, dates []time.Time) error {
    for _, date := range dates {
        dayID := uuid.New().String()
        _, err := d.Conn.Exec(
            "INSERT INTO leave_days (id, leave_id, date) VALUES (?, ?, ?)",
            dayID,
            leaveID,
            date,
        )
        if err != nil {
            return err
        }
    }
    return nil
}

// GetHolidays retrieves all holidays from the database
func (d *Database) GetHolidays() (map[string]bool, error) {
	rows, err := d.Conn.Query("SELECT date FROM holidays")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	holidays := make(map[string]bool)
	for rows.Next() {
		var date time.Time
		if err := rows.Scan(&date); err != nil {
			return nil, err
		}
		// Store in YYYY-MM-DD format for easy comparison
		holidays[date.Format("2006-01-02")] = true
	}
	return holidays, nil
}

// GetAllHolidays retrieves all holidays as a list
func (d *Database) GetAllHolidays() ([]models.Holiday, error) {
	rows, err := d.Conn.Query("SELECT id, date, name FROM holidays ORDER BY date")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holidays []models.Holiday
	for rows.Next() {
		var holiday models.Holiday
		var date time.Time
		if err := rows.Scan(&holiday.ID, &date, &holiday.Name); err != nil {
			return nil, err
		}
		holiday.Date = date.Format("2006-01-02")
		holidays = append(holidays, holiday)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return holidays, nil
}

// GetLeaveDays retrieves all leave day records for a specific leave
func (d *Database) GetLeaveDays(leaveID string) ([]models.LeaveDay, error) {
    query := "SELECT id, leave_id, date, is_half_day, is_morning FROM leave_days WHERE leave_id = ? ORDER BY date"
    rows, err := d.Conn.Query(query, leaveID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var leaveDays []models.LeaveDay
    for rows.Next() {
        var day models.LeaveDay
        if err := rows.Scan(&day.ID, &day.LeaveID, &day.Date, &day.IsHalfDay, &day.IsMorning); err != nil {
            return nil, err
        }
        leaveDays = append(leaveDays, day)
    }

    if err := rows.Err(); err != nil {
        return nil, err
    }

    return leaveDays, nil
}

// GetLeaveDayByID retrieves a specific leave day by its ID
func (d *Database) GetLeaveDayByID(dayID string) (*models.LeaveDay, error) {
    query := "SELECT id, leave_id, date, is_half_day, is_morning FROM leave_days WHERE id = ?"
    var day models.LeaveDay
    err := d.Conn.QueryRow(query, dayID).Scan(&day.ID, &day.LeaveID, &day.Date, &day.IsHalfDay, &day.IsMorning)
    if err != nil {
        return nil, err
    }
    return &day, nil
}

// UpdateLeaveDay updates the half-day status of a leave day
func (d *Database) UpdateLeaveDay(dayID string, isHalfDay bool, isMorning *bool) error {
    query := "UPDATE leave_days SET is_half_day = ?, is_morning = ? WHERE id = ?"
    _, err := d.Conn.Exec(query, isHalfDay, isMorning, dayID)
    return err
}

// ReplaceLeaveDaysAndUpdateLeave replaces all leave day records for a leave and updates the leave
func (db *Database) ReplaceLeaveDaysAndUpdateLeave(leaveID, startDate, endDate string, totalDays int, days []time.Time) error {
    if len(days) == 0 {
        return fmt.Errorf("no working days in date range")
    }
    
    ctx := context.Background()
    tx, err := db.Conn.BeginTx(ctx, nil)
    if err != nil {
        return err
    }

    // ensure the leave is pending (prevent races)
    var status string
    if err := tx.QueryRowContext(ctx, "SELECT status FROM leaves WHERE id = ? FOR UPDATE", leaveID).Scan(&status); err != nil {
        tx.Rollback()
        return err
    }
    if status != "pending" {
        tx.Rollback()
        return fmt.Errorf("leave not editable (status=%s)", status)
    }

    if _, err := tx.ExecContext(ctx, "DELETE FROM leave_days WHERE leave_id = ?", leaveID); err != nil {
        tx.Rollback()
        return err
    }

    stmt, err := tx.PrepareContext(ctx, "INSERT INTO leave_days (id, leave_id, date, is_half_day, is_morning) VALUES (?, ?, ?, ?, ?)")
    if err != nil {
        tx.Rollback()
        return err
    }
    defer stmt.Close()

    for _, d := range days {
        id := uuid.New().String()
        if _, err := stmt.ExecContext(ctx, id, leaveID, d.Format("2006-01-02"), false, nil); err != nil {
            tx.Rollback()
            return err
        }
    }

    res, err := tx.ExecContext(ctx, "UPDATE leaves SET start_date = ?, end_date = ?, total_days = ? WHERE id = ?", startDate, endDate, totalDays, leaveID)
    if err != nil {
        tx.Rollback()
        return err
    }
    if ra, _ := res.RowsAffected(); ra == 0 {
        tx.Rollback()
        return fmt.Errorf("leave not found")
    }

    return tx.Commit()
}

