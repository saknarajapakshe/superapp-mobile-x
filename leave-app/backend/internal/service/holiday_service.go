// internal/service/holiday_service.go
package service

import (
	"leave-app/internal/db"
	"leave-app/internal/models"
	"time"
)

type HolidayService struct {
	DB *db.Database
}

func NewHolidayService(database *db.Database) *HolidayService {
	return &HolidayService{DB: database}
}

// GetHolidaysInRange retrieves holidays within a specific date range to reduce lookup map size
func (s *HolidayService) GetHolidaysInRange(startDate time.Time, endDate time.Time) (map[string]bool, error) {
	rows, err := s.DB.Conn.Query("SELECT date FROM holidays WHERE date >= ? AND date <= ?", startDate, endDate)
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
func (s *HolidayService) GetAllHolidays() ([]models.Holiday, error) {
	rows, err := s.DB.Conn.Query("SELECT id, date, name FROM holidays ORDER BY date")
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

// CalculateWorkingDays calculates working days between start and end dates, excluding weekends and holidays
func (s *HolidayService) CalculateWorkingDays(start time.Time, end time.Time, holidays map[string]bool) []time.Time {
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	end = time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, end.Location())

	var days []time.Time

	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		// Skip weekends
		if d.Weekday() == time.Saturday || d.Weekday() == time.Sunday {
			continue
		}
		
		// Skip holidays
		dateStr := d.Format("2006-01-02")
		if holidays[dateStr] {
			continue
		}
		
		days = append(days, d)
	}

	return days
}
