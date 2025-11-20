// internal/db/db.go
package db

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"lsf-leave-backend/internal/models"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

type Database struct {
	Conn *sql.DB
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

	if err := db.Ping(); err != nil {
		return nil, err
	}

	log.Println("Database connection established")

	return &Database{Conn: db}, nil
}

// Migrate runs the database migrations
func (db *Database) Migrate() error {
	query, err := ioutil.ReadFile("migrations/001_initial.sql")
	if err != nil {
		return fmt.Errorf("could not read migration file: %w", err)
	}

	if _, err := db.Conn.Exec(string(query)); err != nil {
		return fmt.Errorf("could not apply migration: %w", err)
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
	query := "INSERT INTO leaves (id, user_id, type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
	_, err := db.Conn.Exec(query, leave.ID, leave.UserID, leave.Type, leave.StartDate, leave.EndDate, leave.Reason, leave.Status)
	return err
}

func (db *Database) GetAllLeaves() ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.reason, l.status, l.approver_comment, l.created_at
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
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
	}
	return leaves, nil
}

func (db *Database) GetLeavesByUserID(userID string) ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.reason, l.status, l.approver_comment, l.created_at
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
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
	}
	return leaves, nil
}

func (db *Database) GetLeaveByID(leaveID string) (*models.Leave, error) {
	leave := &models.Leave{}
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		WHERE l.id = ?
	`
	err := db.Conn.QueryRow(query, leaveID).Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt)
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
