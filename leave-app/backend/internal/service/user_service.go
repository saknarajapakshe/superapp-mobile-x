package service

import (
	"fmt"

	"leave-app/internal/db"
	"leave-app/internal/models"

	"github.com/google/uuid"
)

// UserService contains business logic related to users.
type UserService struct {
    DB *db.Database
}

// NewUserService constructs a UserService.
func NewUserService(d *db.Database) *UserService {
    return &UserService{DB: d}
}

func (s *UserService) GetUserByEmail(email string) (*models.User, error) {
    user := &models.User{}
    query := "SELECT id, email, role, sick_allowance, annual_allowance, casual_allowance, created_at FROM users WHERE email = ?"
    err := s.DB.Conn.QueryRow(query, email).Scan(&user.ID, &user.Email, &user.Role, &user.Allowances.Sick, &user.Allowances.Annual, &user.Allowances.Casual, &user.CreatedAt)
    if err != nil {
        return nil, err
    }
    return user, nil
}

func (s *UserService) UpdateUserRole(userID string, role models.UserRole) error {
    query := "UPDATE users SET role = ? WHERE id = ?"
    _, err := s.DB.Conn.Exec(query, role, userID)
    return err
}

func (s *UserService) GetAllUsers() ([]models.User, error) {
    rows, err := s.DB.Conn.Query("SELECT id, email, role, sick_allowance, annual_allowance, casual_allowance, created_at FROM users")
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

func (s *UserService) UpdateAllUserAllowances(req models.UpdateAllowancesRequest) error {
    // Reject request if any required field is missing
    if req.Sick == nil || req.Annual == nil || req.Casual == nil {
        return fmt.Errorf("all allowance fields (sick, annual, casual) must be provided")
    }
    
    query := "UPDATE users SET sick_allowance = ?, annual_allowance = ?, casual_allowance = ?"
    _, err := s.DB.Conn.Exec(query, *req.Sick, *req.Annual, *req.Casual)
    return err
}

func (s *UserService) CreateUser(email string) (*models.User, error) {
    user := &models.User{
        ID:    uuid.New().String(),
        Email: email,
        Role:  models.UserRole(models.DefaultUserRole),
        Allowances: models.Allowances{
            Annual: models.DefaultAnnualAllowance,
            Sick:   models.DefaultSickAllowance,
            Casual: models.DefaultCasualAllowance,
        },
    }
    query := "INSERT INTO users (id, email, role, annual_allowance, sick_allowance, casual_allowance) VALUES (?, ?, ?, ?, ?, ?)"
    _, err := s.DB.Conn.Exec(query, user.ID, user.Email, user.Role, user.Allowances.Annual, user.Allowances.Sick, user.Allowances.Casual)
    if err != nil {
        return nil, err
    }
    return s.GetUserByEmail(email)
}
