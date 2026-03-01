package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"leave-app/internal/db"
	"leave-app/internal/models"

	"github.com/google/uuid"
)

// LeaveService contains business logic around leave management.
type LeaveService struct {
	DB *db.Database
}

// NewLeaveService constructs a LeaveService.
func NewLeaveService(d *db.Database) *LeaveService {
	return &LeaveService{DB: d}
}

// CreateLeaveWithTransaction creates a leave and its leave days in a single transaction
func (s *LeaveService) CreateLeaveWithTransaction(leave *models.Leave, dates []time.Time, isHalfDay bool, halfDayPeriod *models.HalfDayPeriod) error {
	ctx := context.Background()
	tx, err := s.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// Generate leave ID
	leave.ID = uuid.New().String()

	// Insert leave record
	query := "INSERT INTO leaves (id, user_id, type, start_date, end_date, total_days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	_, err = tx.ExecContext(ctx, query, leave.ID, leave.UserID, leave.Type, leave.StartDate, leave.EndDate, leave.TotalLeaveDays, leave.Reason, leave.Status)
	if err != nil {
		tx.Rollback()
		return err
	}

	// Insert leave days
	stmt, err := tx.PrepareContext(ctx, "INSERT INTO leave_days (id, leave_id, date, is_half_day, half_day_period) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, date := range dates {
		dayID := uuid.New().String()
		_, err = stmt.ExecContext(ctx, dayID, leave.ID, date.Format("2006-01-02"), isHalfDay, halfDayPeriod)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

// helper to load leave days for a set of leave IDs in one query
func (s *LeaveService) GetLeaveDaysBatch(leaveIDs []string) (map[string][]models.LeaveDay, error) {
	daysMap := make(map[string][]models.LeaveDay)
	if len(leaveIDs) == 0 {
		return daysMap, nil
	}

	// build placeholder list
	placeholders := strings.Repeat("?,", len(leaveIDs))
	placeholders = strings.TrimRight(placeholders, ",")

	query := fmt.Sprintf(
		"SELECT leave_id, id, date, is_half_day, half_day_period FROM leave_days WHERE leave_id IN (%s) ORDER BY date",
		placeholders,
	)

	args := make([]interface{}, len(leaveIDs))
	for i, id := range leaveIDs {
		args[i] = id
	}

	rows, err := s.DB.Conn.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var leaveID string
		var day models.LeaveDay
		var dt time.Time
		if err := rows.Scan(&leaveID, &day.ID, &dt, &day.IsHalfDay, &day.HalfDayPeriod); err != nil {
			return nil, err
		}
		day.Date = dt.Format("2006-01-02")
		day.LeaveID = leaveID
		daysMap[leaveID] = append(daysMap[leaveID], day)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return daysMap, nil
}

// GetAllLeaves returns all leaves with their days embedded
func (s *LeaveService) GetAllLeaves() ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		ORDER BY l.created_at DESC
	`
	rows, err := s.DB.Conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	leaves := make([]models.Leave, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var leave models.Leave
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
		ids = append(ids, leave.ID)
	}

	// get all days in one shot
	daysMap, err := s.GetLeaveDaysBatch(ids)
	if err != nil {
		return nil, fmt.Errorf("failed to get leave days: %w", err)
	}

	// attach days to corresponding leaves
	for i := range leaves {
		leaves[i].Days = daysMap[leaves[i].ID]
	}

	return leaves, nil
}

// GetLeavesByUserID returns all leaves for a specific user with their days embedded
func (s *LeaveService) GetLeavesByUserID(userID string) ([]models.Leave, error) {
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		WHERE l.user_id = ?
		ORDER BY l.created_at DESC
	`
	rows, err := s.DB.Conn.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	leaves := make([]models.Leave, 0)
	ids := make([]string, 0)
	for rows.Next() {
		var leave models.Leave
		if err := rows.Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt); err != nil {
			return nil, err
		}
		leaves = append(leaves, leave)
		ids = append(ids, leave.ID)
	}

	// bulk fetch days
	daysMap, err := s.GetLeaveDaysBatch(ids)
	if err != nil {
		return nil, fmt.Errorf("failed to get leave days: %w", err)
	}
	for i := range leaves {
		leaves[i].Days = daysMap[leaves[i].ID]
	}

	return leaves, nil
}

// GetLeaveByID returns a specific leave by ID with its days embedded
func (s *LeaveService) GetLeaveByID(leaveID string) (*models.Leave, error) {
	leave := &models.Leave{}
	query := `
		SELECT l.id, l.user_id, u.email, l.type, l.start_date, l.end_date, l.total_days, l.reason, l.status, l.approver_comment, l.created_at
		FROM leaves l
		JOIN users u ON l.user_id = u.id
		WHERE l.id = ?
	`
	err := s.DB.Conn.QueryRow(query, leaveID).Scan(&leave.ID, &leave.UserID, &leave.UserEmail, &leave.Type, &leave.StartDate, &leave.EndDate, &leave.TotalLeaveDays, &leave.Reason, &leave.Status, &leave.ApproverComment, &leave.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Populate days
	days, err := s.GetLeaveDays(leave.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get leave days: %w", err)
	}
	leave.Days = days

	return leave, nil
}

func (s *LeaveService) UpdateLeaveStatus(leaveID string, status models.LeaveStatus, comment *string) error {
	query := "UPDATE leaves SET status = ?, approver_comment = ? WHERE id = ?"
	_, err := s.DB.Conn.Exec(query, status, comment, leaveID)
	return err
}

func (s *LeaveService) DeleteLeave(leaveID string) error {
	query := "DELETE FROM leaves WHERE id = ?"
	_, err := s.DB.Conn.Exec(query, leaveID)
	return err
}

// CreateLeaveDays creates leave day records for a leave period with half-day support
func (s *LeaveService) CreateLeaveDays(leaveID string, dates []time.Time, isHalfDay bool, halfDayPeriod *models.HalfDayPeriod) error {
	for _, date := range dates {
		dayID := uuid.New().String()
		_, err := s.DB.Conn.Exec(
			"INSERT INTO leave_days (id, leave_id, date, is_half_day, half_day_period) VALUES (?, ?, ?, ?, ?)",
			dayID,
			leaveID,
			date.Format("2006-01-02"),
			isHalfDay,
			halfDayPeriod,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// GetLeaveDays returns all leave days for a specific leave with half_day_period
func (s *LeaveService) GetLeaveDays(leaveID string) ([]models.LeaveDay, error) {
	query := "SELECT id, leave_id, date, is_half_day, half_day_period FROM leave_days WHERE leave_id = ? ORDER BY date"
	rows, err := s.DB.Conn.Query(query, leaveID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var leaveDays []models.LeaveDay
	for rows.Next() {
		var day models.LeaveDay
		var dateTime time.Time
		if err := rows.Scan(&day.ID, &day.LeaveID, &dateTime, &day.IsHalfDay, &day.HalfDayPeriod); err != nil {
			return nil, err
		}
		day.Date = dateTime.Format("2006-01-02")
		leaveDays = append(leaveDays, day)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return leaveDays, nil
}

// UpdateSingleDayLeaveHalfDay updates the half-day status and total_days for a single-day leave
func (s *LeaveService) UpdateSingleDayLeaveHalfDay(leaveID string, isHalfDay bool, halfDayPeriod *models.HalfDayPeriod) error {
	ctx := context.Background()
	tx, err := s.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// Calculate total days based on half-day status
	totalDays := 1.0
	if isHalfDay {
		totalDays = 0.5
	}

	// Update leave_days table
	if _, err := tx.ExecContext(ctx, "UPDATE leave_days SET is_half_day = ?, half_day_period = ? WHERE leave_id = ?", isHalfDay, halfDayPeriod, leaveID); err != nil {
		tx.Rollback()
		return err
	}

	// Update leaves table total_days
	if _, err := tx.ExecContext(ctx, "UPDATE leaves SET total_days = ? WHERE id = ?", totalDays, leaveID); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// UpdateSingleDayLeaveWithTransaction updates both dates and half-day status in a single transaction
func (s *LeaveService) UpdateSingleDayLeaveWithTransaction(leaveID, startDate, endDate string, totalDays float64, days []time.Time, isHalfDay bool, halfDayPeriod *models.HalfDayPeriod) error {
	if len(days) == 0 {
		return fmt.Errorf("no working days in date range")
	}

	ctx := context.Background()
	tx, err := s.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// ensure the leave is pending
	var status string
	if err := tx.QueryRowContext(ctx, "SELECT status FROM leaves WHERE id = ? FOR UPDATE", leaveID).Scan(&status); err != nil {
		tx.Rollback()
		return err
	}
	if status != string(models.LeaveStatusPending) {
		tx.Rollback()
		return fmt.Errorf("leave not editable (status=%s)", status)
	}

	// Delete old leave days
	if _, err := tx.ExecContext(ctx, "DELETE FROM leave_days WHERE leave_id = ?", leaveID); err != nil {
		tx.Rollback()
		return err
	}

	// Insert new leave days
	stmt, err := tx.PrepareContext(ctx, "INSERT INTO leave_days (id, leave_id, date, is_half_day, half_day_period) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, d := range days {
		id := uuid.New().String()
		if _, err := stmt.ExecContext(ctx, id, leaveID, d.Format("2006-01-02"), isHalfDay, halfDayPeriod); err != nil {
			tx.Rollback()
			return err
		}
	}

	// Update leave record
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

// ReplaceLeaveDaysAndUpdateLeave replaces all leave day records for a leave and updates the leave
func (s *LeaveService) ReplaceLeaveDaysAndUpdateLeave(leaveID, startDate, endDate string, totalDays float64, days []time.Time) error {
	if len(days) == 0 {
		return fmt.Errorf("no working days in date range")
	}

	ctx := context.Background()
	tx, err := s.DB.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// ensure the leave is pending (prevent races)
	var status string
	if err := tx.QueryRowContext(ctx, "SELECT status FROM leaves WHERE id = ? FOR UPDATE", leaveID).Scan(&status); err != nil {
		tx.Rollback()
		return err
	}
	if status != string(models.LeaveStatusPending) {
		tx.Rollback()
		return fmt.Errorf("leave not editable (status=%s)", status)
	}

	if _, err := tx.ExecContext(ctx, "DELETE FROM leave_days WHERE leave_id = ?", leaveID); err != nil {
		tx.Rollback()
		return err
	}

	stmt, err := tx.PrepareContext(ctx, "INSERT INTO leave_days (id, leave_id, date, is_half_day, half_day_period) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, d := range days {
		id := uuid.New().String()
		// Multi-day leaves are always full days (not half-days)
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


